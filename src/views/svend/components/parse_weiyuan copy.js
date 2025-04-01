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

function processExpression(expr) {
  var parts = expr.split('*');
  const firstPart = parseFloat(parts[0]).toString();
  const restParts = parts.slice(1);
  return [firstPart, ...restParts].join('*');
}

async function processSheet(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  try {
    // 1. 读取表头（兼容空列和特殊字符）
    const headerRow = readSheetHeaders(sheet);
    // console.log('处理后的表头:', headerRow);

    // 2. 检查必要列是否存在
    const requiredColumns = [
      '合同编号', '已发货量', '已炼钢', 
      '已轧制', '已船检', '已集港','码头'
    ];
    
    const { missingColumns, colIndex } = validateHeaders(headerRow, requiredColumns);
    if (missingColumns.length > 0) {
      return errorResponse(sheetName, `缺少必要列: ${missingColumns.join(', ')}`);
    }

    // 3. 处理数据行
    const data = processSheetData(sheet, colIndex);
    
    return successResponse(sheetName, data);
  } catch (error) {
    return errorResponse(sheetName, error.message, error);
  }
}

// 辅助函数：读取表头
function readSheetHeaders(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headers = [];
  
  // 查找最后一列有数据的列
  let lastCol = 0;
  for (let c = range.e.c; c >= 0; c--) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell?.v !== undefined) {
      lastCol = c;
      break;
    }
  }

  // 读取所有列头
  for (let c = 0; c <= lastCol; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    headers.push(cell?.v?.toString().trim() || `未命名列_${c}`);
  }

  return headers;
}

// 辅助函数：验证表头
function validateHeaders(headers, requiredColumns) {
  const colIndex = {};
  const missingColumns = [];
  
  requiredColumns.forEach(col => {
    const index = headers.findIndex(h => h.includes(col)); // 允许部分匹配
    if (index === -1) {
      missingColumns.push(col);
    } else {
      colIndex[col] = index;
    }
  });

  return { missingColumns, colIndex };
}

// 辅助函数：处理数据行
function processSheetData(sheet, colIndex) {
  // 设置数据范围（跳过表头）
  const range = XLSX.utils.decode_range(sheet['!ref']);
  range.s.r = 1;
  sheet['!ref'] = XLSX.utils.encode_range(range);

  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const result = [];

  for (const row of jsonData) {
    if (!row[colIndex['合同编号']]) continue;

    const toNum = (val) => Math.max(Number(val) || 0, 0);
    
    result.push({
      合同编号: row[colIndex['合同编号']],
      已发货量: toNum(row[colIndex['已发货量']]),
      已炼钢: toNum(row[colIndex['已炼钢']]),
      已轧制: toNum(row[colIndex['已轧制']]),
      已船检: toNum(row[colIndex['已船检']]),
      已集港: toNum(row[colIndex['已集港']]),
      码头: row[colIndex['码头']]
    });
  }

  return result;
}

// 辅助函数：统一成功响应格式
function successResponse(sheetName, data) {
  return {
    [sheetName]: data,
    success: true
  };
}

// 辅助函数：统一错误响应格式
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
    console.log('脚本里：',result);
    if (!result.success) {
      return { 
        message: `文件处理失败: ${result.message}` 
      };
    }


    return result;


  } catch (err) {
    console.error("操作失败：", err);
    return { message: `系统错误：${err.message}` };
  }
}