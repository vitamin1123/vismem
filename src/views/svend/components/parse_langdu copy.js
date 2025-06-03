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

  // 提取表头数据（原表格的第3-5行，对应索引2-4）
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
    dataStartRow: 5 // 数据从第6行开始（原表格的第6行）
  };
}

export async function langdu(file) {
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
      '合同月份': '合同月份 > 合同月份 > 合同月份',
      '码头': '码头 > 码头 > 码头',
      '未计划重量': '坯料设计 > 未计划 > 重量',
      '未下炼钢重量': '坯料进程 > 未下炼钢 > 重量',
      '轧钢完成重量': '轧钢完成 > 轧钢完成 > 重量',
      '成品在库重量': '成品在库 > 成品在库 > 重量',
      '出库结束重量': '出库结束 > 出库结束 > 重量',
      '已发运重量': '发运 > 发运 > 重量'
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
    const details = [];
    
    // 改进的数值处理函数（处理负数，保留3位小数）
    const formatNum = (val) => {
      const num = Number(val);
      // 允许负数存在，只过滤NaN情况
      return isNaN(num) ? 0 : parseFloat(num.toFixed(3));
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
      const contractMonth = getValue('合同月份');
      const dock = getValue('码头');
      
      // 严格校验关键字段
      if (!contractNo || !materialCode || !size || !contractMonth || !dock) {
        continue;
      }
      
      // 提取月份（严格校验）
      let month = null;
      if (typeof contractMonth === 'string') {
        const monthMatch = contractMonth.match(/^(\d{1,2})月?$/);
        if (monthMatch) {
          month = String(parseInt(monthMatch[1]));
        }
      } else if (contractMonth instanceof Date) {
        month = String(contractMonth.getMonth() + 1);
      }
      
      // 月份格式不正确则跳过
      if (!month || !/^[1-9]|1[0-2]$/.test(month)) {
        continue;
      }
      
      // 码头为空则跳过
      if (typeof dock !== 'string' || dock.trim() === '') {
        continue;
      }
      
      // 初始化汇总结构
      if (!summary[month]) summary[month] = {};
      if (!summary[month][dock]) {
        summary[month][dock] = {
          未炼钢: 0,
          已轧制: 0,
          已船检: 0,
          已集港: 0,
          已发运: 0,
          合同数: 0
        };
      }
      
      // 获取各重量值（允许负数）
      const unplanned = formatNum(getValue('未计划重量'));
      const unsteeled = formatNum(getValue('未下炼钢重量'));
      const rolled = formatNum(getValue('轧钢完成重量'));
      const inStock = formatNum(getValue('成品在库重量'));
      const outbound = formatNum(getValue('出库结束重量'));
      const shipped = formatNum(getValue('已发运重量'));
      
      // 计算组合值（保持原始正负值）
      const unsteelTotal = formatNum(unplanned + unsteeled); // 未炼钢 = 未计划 + 未下炼钢
      const inspected = formatNum(inStock + outbound);      // 已船检 = 成品在库 + 出库结束
      const gathered = outbound;                           // 已集港 = 出库结束
      // 已发运直接使用 shipped 值
      
      // 累加汇总数据（保留原始正负值）
      const target = summary[month][dock];
      target.未炼钢 = formatNum(target.未炼钢 + unsteelTotal);
      target.已轧制 = formatNum(target.已轧制 + rolled);
      target.已船检 = formatNum(target.已船检 + inspected);
      target.已集港 = formatNum(target.已集港 + gathered);
      target.已发运 = formatNum(target.已发运 + shipped);
      target.合同数++;

      // 添加明细数据（保留原始正负值）
      details.push({
        月份: month,
        码头: dock.trim(),
        合同号: contractNo,
        牌号材质代码: materialCode,
        尺寸: size,
        合同月份: contractMonth instanceof Date ? 
          contractMonth.toISOString().split('T')[0] : 
          contractMonth.toString().trim(),
        未计划重量: unplanned,
        未下炼钢重量: unsteeled,
        未炼钢合计: unsteelTotal,
        轧钢完成重量: rolled,
        成品在库重量: inStock,
        出库结束重量: outbound,
        已船检合计: inspected,
        已集港: gathered,
        已发运: shipped
      });
    }

    // 如果没有数据，抛出错误
    if (Object.keys(summary).length === 0 || details.length === 0) {
      throw new Error('未找到有效数据，请检查文件格式是否符合要求');
    }

    return {
      success: true,
      summary: summary,
      details: details,
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