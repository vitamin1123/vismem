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
  if (!sheet['!ref']) {
    throw new Error('无效的工作表，缺少范围定义');
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const merges = sheet['!merges'] || [];
  const headerRows = [];

  // 提取原始表头数据（3行）
  for (let r = 2; r <= 4; r++) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? String(cell.v || '').trim() : '');
    }
    headerRows.push(row);
  }

  // 处理合并单元格
  merges.forEach(merge => {
    if (merge.s.r >= 2 && merge.s.r <= 4) {
      const value = headerRows[merge.s.r - 2][merge.s.c];
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          if (r >= 2 && r <= 4) {
            headerRows[r - 2][c] = value;
          }
        }
      }
    }
  });

  // 构建列定义
  const columns = [];
  for (let c = 0; c < headerRows[0].length; c++) {
    const path = [
      headerRows[0][c],
      headerRows[1][c],
      headerRows[2][c]
    ].filter(Boolean);

    columns.push({
      index: c,
      path: path,
      fullPath: path.join(' > '),
      level1: path[0] || null,
      level2: path[1] || null,
      level3: path[2] || null
    });
  }

  return {
    columns,
    dataStartRow: 5 // 数据从第6行开始
  };
}

export async function zhongchuan(file) {
  try {
    // 1. 读取Excel文件
    const workbook = await readExcelFile(file);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      throw new Error(`找不到工作表: ${sheetName}`);
    }

    // 2. 解析表头
    const { columns, dataStartRow } = parseMergedHeaders(sheet);
    
    // 3. 定义需要查找的列
    const targetColumns = {
      '合同号': '合同号',
      '签订日期': '签订日期',
      '码头': '码头',
      '未炼钢': '坯料设计 > 未计划 > 重量',
      '已轧制': '轧钢完成 > 轧钢完成 > 重量',
      '成品在库': '成品在库 > 成品在库 > 重量',
      '出库结束': '出库结束 > 出库结束 > 重量',
      '发运': '发运 > 发运 > 重量'
    };

    // 4. 检查列匹配情况
    const columnMatches = {};
    for (const [colName, fullPath] of Object.entries(targetColumns)) {
      const foundCol = columns.find(col => col.fullPath === fullPath);
      columnMatches[colName] = foundCol ? {
        index: foundCol.index,
        fullPath: foundCol.fullPath,
        matched: true
      } : {
        fullPath,
        matched: false
      };
    }

    // 5. 提取前5行数据用于验证
    const sampleData = [];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    range.s.r = dataStartRow;
    range.e.r = Math.min(dataStartRow + 5, range.e.r); // 只取前5行
    sheet['!ref'] = XLSX.utils.encode_range(range);

    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 0 });
    for (const row of jsonData) {
      const sampleRow = {};
      for (const [colName, matchInfo] of Object.entries(columnMatches)) {
        if (matchInfo.matched) {
          sampleRow[colName] = row[matchInfo.index];
        }
      }
      sampleData.push(sampleRow);
    }

    return {
      success: true,
      columns: columnMatches,
      availableColumns: columns.map(c => c.fullPath),
      sampleData: sampleData,
      sheetName: sheetName,
      dataStartRow: dataStartRow
    };

  } catch (error) {
    console.error('调试失败:', error);
    return {
      success: false,
      message: `调试失败: ${error.message}`,
      error: error.stack
    };
  }
}