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
      '已轧制', '已船检', '已集港','码头'
    ];
    
    const { missingColumns, colIndex } = validateHeaders(headerRow, requiredColumns);
    if (missingColumns.length > 0) {
      return errorResponse(sheetName, `缺少必要列: ${missingColumns.join(', ')}`);
    }

    // 3. 处理数据行并按月份+码头聚合
    const aggregatedData = aggregateByMonthAndDock(sheet, colIndex);
    
    return successResponse(sheetName, aggregatedData);
  } catch (error) {
    return errorResponse(sheetName, error.message, error);
  }
}

// 新增函数：按月份和码头聚合数据
function aggregateByMonthAndDock(sheet, colIndex) {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  range.s.r = 1;
  sheet['!ref'] = XLSX.utils.encode_range(range);

  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const result = {};

  for (const row of jsonData) {
    if (!row[colIndex['合同编号']]) continue;

    // 提取月份 (如从 "25XSH-SJ-2C043" 提取 "2月")
    const contractNumber = row[colIndex['合同编号']];
    const monthPart = contractNumber.split('-')[2]?.substr(0, 2) || '';
    const month = `${parseInt(monthPart)}月`;

    const dock = row[colIndex['码头']] || '未知码头';
    const toNum = (val) => Math.max(Number(val)) || 0;

    // 初始化数据结构
    if (!result[month]) result[month] = {};
    if (!result[month][dock]) {
      result[month][dock] = {
        已发货量: 0,
        已炼钢: 0,
        已轧制: 0,
        已船检: 0,
        已集港: 0
      };
    }

    // 累加数据
    const target = result[month][dock];
    target.已发货量 += toNum(row[colIndex['已发货量']]);
    target.已炼钢 += toNum(row[colIndex['已炼钢']]);
    target.已轧制 += toNum(row[colIndex['已轧制']]);
    target.已船检 += toNum(row[colIndex['已船检']]);
    target.已集港 += toNum(row[colIndex['已集港']]);
  }

  return result;
}

// 保持以下辅助函数不变 (直接使用你原来的实现)
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
      byMonthDock: result[workbook.SheetNames[0]], // 提取聚合后的数据
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