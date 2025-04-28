import * as XLSX from 'xlsx';

async function readExcelFile(file) {
  const rawFile = file.raw || file;
  
  if (!(rawFile instanceof Blob)) {
    throw new Error('无效的文件对象');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        resolve(workbook);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(rawFile);
  });
}

async function processSheet(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  try {
    // 1. 读取表头
    const headerRow = readSheetHeaders(sheet);
    
    // 2. 检查必要列是否存在
    const requiredColumns = [
      '合同编号', '已发货量', '已炼钢', 
      '已轧钢', '已船检', '已集港', '码头',
      '订单钢种', '订单厚度', '订单宽度', '订单长度', '单重' // 新增'单重'列
    ];
    
    const { missingColumns, colIndex } = validateHeaders(headerRow, requiredColumns);
    if (missingColumns.length > 0) {
      return errorResponse(sheetName, `缺少必要列: ${missingColumns.join(', ')}`);
    }

    // 3. 处理数据行并获取明细和聚合数据
    const { detailData, aggregatedData } = processData(sheet, colIndex);
    
    return successResponse(sheetName, { detailData, aggregatedData });
  } catch (error) {
    return errorResponse(sheetName, error.message, error);
  }
}

function processData(sheet, colIndex) {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  range.s.r = 1;
  sheet['!ref'] = XLSX.utils.encode_range(range);

  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const detailData = [];
  const aggregatedData = {};

  for (const row of jsonData) {
    if (!row[colIndex['合同编号']]) continue;

    // 规格描述 = 厚度*宽度*长度
    const thickness = row[colIndex['订单厚度']] || '';
    const width = row[colIndex['订单宽度']] || '';
    const length = row[colIndex['订单长度']] || '';
    const specDescription = `${thickness}*${width}*${length}`;
    
    // 计算已发运 = 单重 * 已发货量
    const unitWeight = Number(row[colIndex['单重']]) || 0;
    const shippedQuantity = Number(row[colIndex['已发货量']]) || 0;
    const shippedWeight = unitWeight * shippedQuantity;

    // 提取明细数据
    const detailItem = {
      合同编号: row[colIndex['合同编号']],
      订单钢种: row[colIndex['订单钢种']] || '',
      规格描述: specDescription,
      已发运: shippedWeight, // 修改为计算后的值
      已炼钢: Math.max(Number(row[colIndex['已炼钢']])) || 0,
      已轧制: Math.max(Number(row[colIndex['已轧钢']])) || 0,
      已船检: Math.max(Number(row[colIndex['已船检']])) || 0,
      已集港: Math.max(Number(row[colIndex['已集港']])) || 0,
      码头: row[colIndex['码头']] || '未知码头'
    };
    detailData.push(detailItem);

    // 提取月份 (如从 "25XSH-SJ-2C043" 提取 "2月")
    const contractNumber = row[colIndex['合同编号']];
    const monthPart = contractNumber.split('-')[2]?.substr(0, 2) || '';
    const month = `${parseInt(monthPart)}月`;

    const dock = detailItem.码头;
    
    // 初始化聚合数据结构
    if (!aggregatedData[month]) aggregatedData[month] = {};
    if (!aggregatedData[month][dock]) {
      aggregatedData[month][dock] = {
        已发运: 0, // 修改字段名
        已炼钢: 0,
        已轧制: 0,
        已船检: 0,
        已集港: 0
      };
    }

    // 累加聚合数据
    const target = aggregatedData[month][dock];
    target.已发运 += detailItem.已发运; // 使用计算后的值
    target.已炼钢 += detailItem.已炼钢;
    target.已轧制 += detailItem.已轧制;
    target.已船检 += detailItem.已船检;
    target.已集港 += detailItem.已集港;
  }

  return { detailData, aggregatedData };
}

// 保持以下辅助函数不变
function readSheetHeaders(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headers = [];
  
  let lastCol = 0;
  for (let c = range.e.c; c >= 0; c--) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell?.v !== undefined) {
      lastCol = c;
      break;
    }
  }

  for (let c = 0; c <= lastCol; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    headers.push(cell?.v?.toString().trim() || `未命名列_${c}`);
  }

  return headers;
}

function validateHeaders(headers, requiredColumns) {
  const colIndex = {};
  const missingColumns = [];
  
  requiredColumns.forEach(col => {
    const index = headers.findIndex(h => h.includes(col));
    if (index === -1) {
      missingColumns.push(col);
    } else {
      colIndex[col] = index;
    }
  });

  return { missingColumns, colIndex };
}

function successResponse(sheetName, data) {
  return {
    [sheetName]: data,
    success: true
  };
}

function errorResponse(sheetName, message, error = null) {
  console.error(`[${sheetName}] 处理失败:`, message, error);
  return {
    message: `${sheetName}处理失败: ${message}`,
    success: false,
    error: error?.message
  };
}

export async function weiyuan(file) {
  try {
    const workbook = await readExcelFile(file);
    const result = await processSheet(workbook);
    
    if (!result.success) {
      return { 
        message: result.message,
        success: false
      };
    }

    return {
      detail: result[workbook.SheetNames[0]].detailData, // 明细数据
      byMonthDock: result[workbook.SheetNames[0]].aggregatedData, // 聚合数据
      success: true
    };

  } catch (err) {
    console.error("操作失败：", err);
    return { 
      message: `系统错误：${err.message}`,
      success: false 
    };
  }
}