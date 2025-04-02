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
    
    // 3. 定义需要提取的列
    const targetColumns = {
      '合同号': '合同号 > 合同号 > 合同号',
      '牌号/材质代码': '牌号/材质代码 > 牌号/材质代码 > 牌号/材质代码',
      '尺寸': '尺寸 > 尺寸 > 尺寸',
      '签订日期': '签订日期',
      '码头': '码头',
      '未炼钢': '坯料设计 > 未计划 > 重量',
      '已轧制': '轧钢完成 > 轧钢完成 > 重量',
      '成品在库': '成品在库 > 成品在库 > 重量',
      '出库结束': '出库结束 > 出库结束 > 重量',
      '发运': '发运 > 发运 > 重量'
    };

    // 4. 构建列索引
    const colIndex = {};
    for (const [colName, fullPath] of Object.entries(targetColumns)) {
      const col = columns.find(c => c.fullPath === fullPath);
      if (!col) throw new Error(`找不到列: ${fullPath}`);
      colIndex[colName] = col.index;
    }

    // 5. 处理数据汇总和明细
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const summary = {};
    const details = []; // 新增明细数据数组
    
    // 数值处理函数（保留3位小数）
    const formatNum = (val) => {
      const num = Math.max(Number(val) || 0, 0);
      return parseFloat(num.toFixed(3));
    };

    for (let r = dataStartRow; r <= range.e.r; r++) {
      // 获取单元格值
      const getValue = (colName) => {
        const cell = sheet[XLSX.utils.encode_cell({ r, c: colIndex[colName] })];
        return cell ? cell.v : null;
      };

      const contractNo = getValue('合同号');
      const materialCode = getValue('牌号/材质代码');
      const size = getValue('尺寸');
      const signDate = getValue('签订日期');
      const dock = getValue('码头');
      
      // 跳过无码头数据
      if (!dock || dock.toString().trim() === '') continue;
      
      // 提取月份（只要数字）
      let month = null;
      if (signDate instanceof Date) {
        month = String(signDate.getMonth() + 1); // 1-12
      } else if (typeof signDate === 'string') {
        const monthMatch = signDate.match(/(\d{1,2})月?/);
        if (monthMatch) month = String(parseInt(monthMatch[1]));
      }
      
      // 跳过无月份数据
      if (!month) continue;
      
      // 初始化汇总结构
      if (!summary[month]) summary[month] = {};
      if (!summary[month][dock]) {
        summary[month][dock] = {
          未炼钢: 0,
          已轧制: 0,
          成品在库: 0,
          出库结束: 0,
          发运: 0,
          合同数: 0
        };
      }
      
      // 获取各重量值
      const unplanned = formatNum(getValue('未炼钢') || 0);
      const rolled = formatNum(getValue('已轧制') || 0);
      const inStock = formatNum(getValue('成品在库') || 0);
      const outbound = formatNum(getValue('出库结束') || 0);
      const shipped = formatNum(getValue('发运') || 0);
      
      // 累加汇总数据
      const target = summary[month][dock];
      target.未炼钢 = formatNum(target.未炼钢 + unplanned);
      target.已轧制 = formatNum(target.已轧制 + rolled);
      target.成品在库 = formatNum(target.成品在库 + inStock);
      target.出库结束 = formatNum(target.出库结束 + outbound);
      target.发运 = formatNum(target.发运 + shipped);
      target.合同数++;
      
      // 添加明细数据
      details.push({
        月份: month,
        码头: dock,
        合同号: contractNo,
        牌号材质代码: materialCode,
        尺寸: size,
        签订日期: signDate instanceof Date ? signDate.toISOString().split('T')[0] : signDate,
        未炼钢: unplanned,
        已轧制: rolled,
        成品在库: inStock,
        出库结束: outbound,
        发运: shipped,
        原始行号: r + 1 // Excel行号从1开始
      });
    }

    return {
      success: true,
      summary: summary,
      details: details, // 新增明细数据
      columns: colIndex,
      sheetName: sheetName
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