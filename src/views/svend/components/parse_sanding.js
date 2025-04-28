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

function parseHeaders(sheet) {
  if (!sheet['!ref']) throw new Error('无效的工作表，缺少范围定义');

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headerRow = [];

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    headerRow.push(cell ? String(cell.v || '').trim() : '');
  }

  const columns = headerRow.map((header, index) => ({
    index,
    header,
    fullPath: header
  }));

  return { 
    columns,
    dataStartRow: 1
  };
}

export async function sanding(file) {
  try {
    const workbook = await readExcelFile(file);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`找不到工作表: ${sheetName}`);

    const { columns, dataStartRow } = parseHeaders(sheet);
    console.log(`数据起始行索引: ${dataStartRow}（Excel第${dataStartRow + 1}行）`);

    // 目标列定义（保持原始Excel列名）
    const targetColumns = {
      '码头': '水运路线',       // Excel中是'水运路线'，我们显示为'码头'
      '钢种': '钢种',
      '厚宽长': '厚宽长',
      '已炼钢': '炼钢计划',     // Excel中是'炼钢计划'，我们显示为'已炼钢'
      '已轧制': '轧钢计划',     // Excel中是'轧钢计划'，我们显示为'已轧制'
      '已船检': '船检',        // Excel中是'船检'，我们显示为'已船检'
      '已发数量': '集港+发运',   // 这个字段会同时用于'已集港'和'已发运'
      '合同号': '合同号'
    };

    const colIndex = {};
    let allColumnsValid = true;
    const missingColumns = [];
    
    console.log('===== 列匹配验证 =====');
    for (const [displayName, excelHeader] of Object.entries(targetColumns)) {
      const col = columns.find(c => c.header === excelHeader);
      if (!col) {
        console.error(`❌ 列缺失: ${displayName.padEnd(6)} -> ${excelHeader}`);
        missingColumns.push(displayName);
        allColumnsValid = false;
        continue;
      }
      colIndex[displayName] = col.index; // 使用显示名称作为索引键
      
      const testCell = sheet[XLSX.utils.encode_cell({ r: dataStartRow, c: col.index })];
      console.log(`✅ ${displayName.padEnd(6)} -> 列${col.index} | 首行值: ${testCell ? testCell.v : '空'}`);
    }

    if (!allColumnsValid) {
      throw new Error(`缺少必要的列: ${missingColumns.join(', ')}`);
    }

    const requiredColumns = ['码头', '合同号'];
    const missingValues = requiredColumns.filter(col => {
      const cell = sheet[XLSX.utils.encode_cell({ r: dataStartRow, c: colIndex[col] })];
      return !cell || cell.v === undefined || cell.v === null;
    });

    if (missingValues.length > 0) {
      throw new Error(`首行数据缺失: ${missingValues.join(', ')}\n请确认数据起始行是否正确`);
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const summary = {};
    const details = [];
    let processedRows = 0;

    const formatNum = (val) => {
      const num = Number(val);
      return isNaN(num) ? 0 : parseFloat(num.toFixed(3));
    };

    console.log('\n===== 开始处理数据 =====');
    for (let r = dataStartRow; r <= range.e.r; r++) {
      const getValue = (colName) => {
        const cell = sheet[XLSX.utils.encode_cell({ r, c: colIndex[colName] })];
        return cell ? cell.v : null;
      };

      if (r === dataStartRow) {
        console.log('首行数据样例:');
        requiredColumns.forEach(col => {
          const val = getValue(col);
          console.log(`  ${col}: ${val} (${typeof val})`);
        });
      }

      const wharf = getValue('码头');        // 原'水运路线'
      const contractNo = getValue('合同号');

      if (!wharf || !contractNo) {
        continue;
      }

      // 月份提取逻辑
      let month = '';
      try {
        const contractStr = String(contractNo);
        if (contractStr.length >= 10) {
          const monthPart = contractStr.substring(7, 10);
          const monthNum = parseInt(monthPart, 10);
          
          if (monthNum >= 10 && monthNum <= 120 && monthNum % 10 === 0) {
            month = (monthNum / 10).toString();
          } else {
            throw new Error('Invalid month format');
          }
        } else {
          throw new Error('Contract number too short');
        }
      } catch (error) {
        console.warn(`行${r + 1} 合同号月份提取失败: ${contractNo}`);
        continue;
      }

      const monthKey = String(month);
      const wharfKey = String(wharf).trim();
      const summaryKey = `${monthKey}-${wharfKey}`;
      
      summary[summaryKey] = summary[summaryKey] || {
        月份: monthKey,
        月份显示: `${month}月`,
        码头: wharfKey,                  // 使用新字段名'码头'
        已炼钢: 0,                      // 原'炼钢计划'
        已轧制: 0,                      // 原'轧钢计划'
        已船检: 0,                      // 原'船检'
        已集港: 0,                      // 与'已发数量'相同
        已发运: 0,                      // 与'已发数量'相同
        合同数: 0
      };

      const target = summary[summaryKey];
      const shippedQty = formatNum(getValue('已发数量'));
      
      target.已炼钢 += formatNum(getValue('已炼钢'));
      target.已轧制 += formatNum(getValue('已轧制'));
      target.已船检 += formatNum(getValue('已船检'));
      target.已集港 += shippedQty;       // 使用相同的已发数量值
      target.已发运 += shippedQty;       // 使用相同的已发数量值
      target.合同数++;

      const dimensions = String(getValue('厚宽长') || '').split(/[×xX*]/).map(Number);
      const [thickness, width, length] = dimensions.length === 3 ? dimensions : [0, 0, 0];

      details.push({
        月份: monthKey,
        月份显示: `${month}月`,
        码头: wharfKey,                  // 使用新字段名'码头'
        钢种: String(getValue('钢种') || ''),
        厚度: formatNum(thickness),
        宽度: formatNum(width),
        长度: formatNum(length),
        已炼钢: formatNum(getValue('已炼钢')),  // 使用新字段名
        已轧制: formatNum(getValue('已轧制')),  // 使用新字段名
        已船检: formatNum(getValue('已船检')),  // 使用新字段名
        已集港: shippedQty,               // 使用已发数量的值
        已发运: shippedQty,               // 使用已发数量的值
        合同号: String(contractNo),
        原始厚宽长: String(getValue('厚宽长') || ''),
      });

      processedRows++;
    }

    console.log(`\n处理完成: 有效行 ${processedRows}`);
    if (processedRows === 0) {
      throw new Error('无有效数据处理。可能原因:\n1. 数据起始行设置错误\n2. 关键字段值为空\n3. 合同号格式不匹配');
    }

    const summaryArray = Object.values(summary);

    return {
      success: true,
      summary: summaryArray,
      details,
      columns: colIndex,
      sheetName,
      stats: { processedRows }
    };

  } catch (error) {
    console.error('处理失败:', error);
    return {
      success: false,
      message: `处理失败: ${error.message}`,
      error: error.stack
    };
  }
}