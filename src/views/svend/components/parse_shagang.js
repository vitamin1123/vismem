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

function extractMonthFromContractNo(contractNo) {
  if (!contractNo) return null;
  
  const str = String(contractNo).toUpperCase();
  const monthMap = {
    'A': 10,
    'B': 11,
    'C': 12
  };
  
  const monthMatch = str.match(/K5(\d|[A-C])B?/);
  if (!monthMatch) return null;
  
  const monthCode = monthMatch[1];
  
  if (monthMap[monthCode]) {
    return monthMap[monthCode];
  }
  
  const monthNum = parseInt(monthCode, 10);
  if (monthNum >= 1 && monthNum <= 9) {
    return monthNum;
  }
  
  return null;
}

export async function shagang(file) {
  try {
    const workbook = await readExcelFile(file);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`找不到工作表: ${sheetName}`);

    const { columns, dataStartRow } = parseHeaders(sheet);
    console.log(`数据起始行索引: ${dataStartRow}（Excel第${dataStartRow + 1}行）`);

    const targetColumns = {
      '合同号': '合同号',
      '合约号': '合约号',
      '码头': '码头',
      '厚度(MM)': '厚度(MM)',
      '最大宽度(MM)': '最大宽度(MM)',
      '最大长度(MM)': '最大长度(MM)',
      '钢级牌号': '钢级牌号',
      '可编计划量': '可编计划量',
      '计划释放量': '计划释放量',
      '出厂量': '出厂量',
      '组板欠量': '组板欠量',
      '轧机在库量': '轧机在库量',
      '轧机欠量': '轧机欠量'
    };

    const colIndex = {};
    let allColumnsValid = true;
    const missingColumns = [];
    
    console.log('===== 列匹配验证 =====');
    for (const [colName, header] of Object.entries(targetColumns)) {
      const col = columns.find(c => c.header === header);
      if (!col) {
        console.error(`❌ 列缺失: ${colName.padEnd(8)} -> ${header}`);
        missingColumns.push(colName);
        allColumnsValid = false;
        continue;
      }
      colIndex[colName] = col.index;
      
      const testCell = sheet[XLSX.utils.encode_cell({ r: dataStartRow, c: col.index })];
      console.log(`✅ ${colName.padEnd(8)} -> 列${col.index} | 首行值: ${testCell ? testCell.v : '空'}`);
    }

    if (!allColumnsValid) {
      throw new Error(`缺少必要的列: ${missingColumns.join(', ')}`);
    }

    const requiredColumns = ['合同号', '合约号', '码头'];
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

      const contractNo = getValue('合约号');
      const wharf = getValue('码头');
      const contractId = getValue('合同号');

      if (!contractNo || !wharf || !contractId) {
        continue;
      }

      const month = extractMonthFromContractNo(contractNo);
      if (!month || month < 1 || month > 12) {
        console.warn(`行${r + 1} 合约号格式无效，无法提取月份: ${contractNo}`);
        continue;
      }

      const monthKey = String(month); // 修改点：不再补零
      const monthDisplay = `${month}月`;
      const wharfKey = String(wharf).trim();

      const summaryKey = `${monthKey}-${wharfKey}`;
      
      if (!summary[summaryKey]) {
        summary[summaryKey] = {
          月份: monthKey,      // 修改点：直接使用不补零的数字
          月份显示: monthDisplay,
          码头: wharfKey,
          已船检: 0,
          未集港: 0,
          已发运: 0,
          未炼钢: 0,
          未轧制: 0,
          合同数: 0
        };
      }

      const targetSummary = summary[summaryKey];
      
      targetSummary.已船检 += formatNum(getValue('可编计划量'));
      targetSummary.未集港 += formatNum(getValue('计划释放量'));
      targetSummary.已发运 += formatNum(getValue('出厂量'));
      targetSummary.未炼钢 += formatNum(getValue('组板欠量'));
      targetSummary.未轧制 += formatNum(getValue('轧机在库量')) + formatNum(getValue('轧机欠量'));
      targetSummary.合同数++;

      details.push({
        月份: monthKey,      // 修改点：直接使用不补零的数字
        月份显示: monthDisplay,
        码头: wharfKey,
        合同号: String(contractId),
        合约号: String(contractNo),
        厚度: formatNum(getValue('厚度(MM)')),
        最大宽度: formatNum(getValue('最大宽度(MM)')),
        最大长度: formatNum(getValue('最大长度(MM)')),
        钢级牌号: String(getValue('钢级牌号') || ''),
        已船检: formatNum(getValue('可编计划量')),
        未集港: formatNum(getValue('计划释放量')),
        已发运: formatNum(getValue('出厂量')),
        未炼钢: formatNum(getValue('组板欠量')),
        未轧制: formatNum(getValue('轧机在库量')) + formatNum(getValue('轧机欠量')),
        原始合约号: String(contractNo)
      });

      processedRows++;
    }

    console.log(`\n处理完成: 有效行 ${processedRows}`);
    if (processedRows === 0) {
      throw new Error('无有效数据处理。可能原因:\n1. 数据起始行设置错误\n2. 关键字段值为空\n3. 合约号格式不匹配');
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