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

  // 读取单层表头（索引0对应Excel第1行）
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    headerRow.push(cell ? String(cell.v || '').trim() : '');
  }

  // 构建列定义
  const columns = headerRow.map((header, index) => ({
    index,
    header,
    fullPath: header
  }));

  return { 
    columns,
    dataStartRow: 1 // 数据从索引1开始（Excel第2行）
  };
}

export async function xingcheng(file) {
  try {
    const workbook = await readExcelFile(file);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`找不到工作表: ${sheetName}`);

    const { columns, dataStartRow } = parseHeaders(sheet);
    console.log(`数据起始行索引: ${dataStartRow}（Excel第${dataStartRow + 1}行）`);

    // 目标列定义
    const targetColumns = {
      '月份': '月份',
      '标准': '标准',
      '订货厚度': '订货厚度',
      '订货宽度': '订货宽度',
      '订货长度': '订货长度',
      '炼钢下线量': '炼钢下线量',
      '轧钢下线量': '轧钢下线量',
      '入库量': '入库量',
      '合同备注': '合同备注',
      '发货重量': '发货重量',
      '书面合同号': '书面合同号'
    };

    // 构建列索引（增强验证）
    const colIndex = {};
    let allColumnsValid = true;
    const missingColumns = [];
    
    console.log('===== 列匹配验证 =====');
    for (const [colName, header] of Object.entries(targetColumns)) {
      const col = columns.find(c => c.header === header);
      if (!col) {
        console.error(`❌ 列缺失: ${colName.padEnd(6)} -> ${header}`);
        missingColumns.push(colName);
        allColumnsValid = false;
        continue;
      }
      colIndex[colName] = col.index;
      
      // 验证数据行是否存在值
      const testCell = sheet[XLSX.utils.encode_cell({ r: dataStartRow, c: col.index })];
      console.log(`✅ ${colName.padEnd(6)} -> 列${col.index} | 首行值: ${testCell ? testCell.v : '空'}`);
    }

    if (!allColumnsValid) {
      throw new Error(`缺少必要的列: ${missingColumns.join(', ')}`);
    }

    // 必要列二次验证
    const requiredColumns = ['月份', '标准', '书面合同号'];
    const missingValues = requiredColumns.filter(col => {
      const cell = sheet[XLSX.utils.encode_cell({ r: dataStartRow, c: colIndex[col] })];
      return !cell || cell.v === undefined || cell.v === null;
    });

    if (missingValues.length > 0) {
      throw new Error(`首行数据缺失: ${missingValues.join(', ')}\n请确认数据起始行是否正确`);
    }

    // 数据处理
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

      // 调试输出首行数据
      if (r === dataStartRow) {
        console.log('首行数据样例:');
        requiredColumns.forEach(col => {
          const val = getValue(col);
          console.log(`  ${col}: ${val} (${typeof val})`);
        });
      }

      const monthRaw = getValue('月份');
      const standard = getValue('标准');
      const contractNo = getValue('书面合同号');

      // 严格校验关键字段
      if (monthRaw === null || monthRaw === undefined || !standard || !contractNo) {
        continue;
      }

      // 处理月份 - 去掉"月"字
      let month = String(monthRaw).replace('月', '').trim();
      if (!month || isNaN(month)) {
        console.warn(`行${r + 1} 月份格式无效: ${monthRaw}`);
        continue;
      }

      // 处理合同备注 - 替换特定字符串
      const remarkRaw = getValue('合同备注') || '';
      const remark = String(remarkRaw).replace('入库按合约号堆放', '').replace(',', '').trim();

      // 数据累加
      const monthKey = String(month);
      summary[monthKey] = summary[monthKey] || {
        已炼钢: 0, 已轧制: 0, 已船检: 0,
        已集港: 0, 已发运: 0, 合同数: 0
      };

      const target = summary[monthKey];
      target.已炼钢 += formatNum(getValue('炼钢下线量'));
      target.已轧制 += formatNum(getValue('轧钢下线量'));
      target.已船检 += formatNum(getValue('入库量'));
      target.已集港 += formatNum(getValue('入库量')); // 同已船检
      target.已发运 += formatNum(getValue('发货重量'));
      target.合同数++;

      details.push({
        月份: monthKey,
        月份显示: `${month}月`,
        标准: String(standard),
        书面合同号: String(contractNo),
        订货厚度: formatNum(getValue('订货厚度')),
        订货宽度: formatNum(getValue('订货宽度')),
        订货长度: formatNum(getValue('订货长度')),
        炼钢下线量: formatNum(getValue('炼钢下线量')),
        轧钢下线量: formatNum(getValue('轧钢下线量')),
        入库量: formatNum(getValue('入库量')),
        发货重量: formatNum(getValue('发货重量')),
        合同备注: remark,
        原始月份: String(monthRaw),
      });

      processedRows++;
    }

    console.log(`\n处理完成: 有效行 ${processedRows}`);
    if (processedRows === 0) {
      throw new Error('无有效数据处理。可能原因:\n1. 数据起始行设置错误\n2. 关键字段值为空\n3. 月份格式不匹配');
    }

    return {
      success: true,
      summary,
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