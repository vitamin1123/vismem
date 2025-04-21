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

function parseMergedHeaders(sheet) {
  if (!sheet['!ref']) throw new Error('无效的工作表，缺少范围定义');

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const merges = sheet['!merges'] || [];
  const headerRows = [];

  // 读取两层表头（索引0-1对应Excel第1-2行）
  for (let r = 0; r <= 1; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? String(cell.v || '').trim() : '');
    }
    headerRows.push(row);
  }

  // 处理合并单元格
  merges.forEach(merge => {
    if (merge.s.r >= 0 && merge.s.r <= 1) {
      const value = headerRows[merge.s.r][merge.s.c];
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (r >= 0 && r <= 1) headerRows[r][c] = value;
        }
      }
    }
  });

  // 构建列定义
  const columns = [];
  for (let c = 0; c < headerRows[0].length; c++) {
    const path = [headerRows[0][c], headerRows[1][c]].filter(Boolean);
    columns.push({
      index: c,
      path: path,
      fullPath: path.join(' > '),
      level1: path[0] || null,
      level2: path[1] || null
    });
  }

  return { 
    columns,
    dataStartRow: 2 // 明确指定数据从索引2开始（Excel第3行）
  };
}

export async function deruisi(file) {
  try {
    const workbook = await readExcelFile(file);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`找不到工作表: ${sheetName}`);

    const { columns, dataStartRow } = parseMergedHeaders(sheet);
    console.log(`数据起始行索引: ${dataStartRow}（Excel第${dataStartRow + 1}行）`);

    // 目标列定义
    const targetColumns = {
      '订货月': '订货月 > 订货月',
      '码头': '码头 > 码头',
      '钢种': '钢种 > 钢种',
      '订货厚度': '订货厚度 > 订货厚度',
      '订货宽度': '订货宽度 > 订货宽度',
      '订货长度': '订货长度 > 订货长度',
      '未集港': '准发确认（在库量/欠量） > 欠量',
      '已发运': '发货 > 已发量',
      '未发运': '发货 > 欠量',
      '未船检': '材合（在库量/欠量） > 欠量',
      '未炼钢': '炼钢工序（在库量/欠量） > 欠量',
      '未轧制': '厚板轧制（在库量/欠量） > 欠量'
    };

    // 构建列索引（增强验证）
    const colIndex = {};
    const missingColumns = [];
    
    console.log('===== 列匹配验证 =====');
    for (const [colName, fullPath] of Object.entries(targetColumns)) {
      const col = columns.find(c => c.fullPath === fullPath);
      if (!col) {
        missingColumns.push({ name: colName, path: fullPath });
        console.error(`❌ 列缺失: ${colName.padEnd(6)} -> ${fullPath}`);
        continue;
      }
      colIndex[colName] = col.index;
      
      // 验证数据行是否存在值
      const testCell = sheet[XLSX.utils.encode_cell({ r: dataStartRow, c: col.index })];
      console.log(`✅ ${colName.padEnd(6)} -> 列${col.index} | 首行值: ${testCell ? testCell.v : '空'}`);
    }

    if (missingColumns.length > 0) {
      // 构建详细的错误信息
      const errorDetails = missingColumns.map(m => 
        `- ${m.name}: 未找到路径 "${m.path}"`
      ).join('\n');
      
      throw new Error(`以下列未匹配:\n${errorDetails}\n\n请检查Excel表头是否包含这些列，或路径定义是否正确`);
    }

    // 必要列二次验证
    const requiredColumns = ['订货月', '码头', '钢种'];
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

    const excelDateToMonth = (serial) => {
      if (!serial || isNaN(serial)) return null;
      const utcDays = Math.floor(serial - 25569);
      const date = new Date(utcDays * 86400 * 1000);
      return date.getMonth() + 1;
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

      const orderMonth = getValue('订货月');
      const dock = getValue('码头');
      const steelGrade = getValue('钢种');

      // 严格校验关键字段
      if (orderMonth === null || orderMonth === undefined || !dock || !steelGrade) {
        continue;
      }

      // 日期处理（兼容三种格式）
      let month;
      if (typeof orderMonth === 'number') {
        month = orderMonth > 12 ? excelDateToMonth(orderMonth) : Math.floor(orderMonth);
      } else if (typeof orderMonth === 'string') {
        const match = orderMonth.match(/(\d{1,2})月?/);
        month = match ? parseInt(match[1]) : null;
      }

      if (!month || month < 1 || month > 12) {
        console.warn(`行${r + 1} 月份格式无效: ${orderMonth}`);
        continue;
      }

      // 数据累加
      const monthKey = String(month);
      summary[monthKey] = summary[monthKey] || {};
      summary[monthKey][dock] = summary[monthKey][dock] || {
        未炼钢: 0, 未轧制: 0, 未船检: 0,
        未集港: 0, 已发运: 0, 未发运: 0, 合同数: 0
      };

      const target = summary[monthKey][dock];
      [
        ['未炼钢', '未炼钢'],
        ['未轧制', '未轧制'],
        ['未船检', '未船检'],
        ['未集港', '未集港'],
        ['已发运', '已发运'],
        ['未发运', '未发运']
      ].forEach(([field, col]) => {
        target[field] += formatNum(getValue(col));
      });
      target.合同数++;

      details.push({
        月份: monthKey,
        月份显示: `${month}月`,
        码头: String(dock).trim(),
        钢种: String(steelGrade),
        订货厚度: getValue('订货厚度'),
        订货宽度: getValue('订货宽度'),
        订货长度: getValue('订货长度'),
        订货月份: typeof orderMonth === 'number' && orderMonth > 12 ?
          new Date((orderMonth - 25569) * 86400 * 1000).toISOString().split('T')[0] :
          String(orderMonth),
        未炼钢: formatNum(getValue('未炼钢')),
        未轧制: formatNum(getValue('未轧制')),
        未船检: formatNum(getValue('未船检')),
        未集港: formatNum(getValue('未集港')),
        已发运: formatNum(getValue('已发运')),
        未发运: formatNum(getValue('未发运')),
      });

      processedRows++;
    }

    console.log(`\n处理完成: 有效行 ${processedRows}`);
    if (processedRows === 0) {
      throw new Error('无有效数据处理。可能原因:\n1. 数据起始行设置错误\n2. 关键字段值为空\n3. 日期格式不匹配');
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
      message: error.message,
      error: error.stack
    };
  }
}