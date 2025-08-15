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

function parseSingleHeader(sheet) {
  if (!sheet['!ref']) throw new Error('无效的工作表，缺少范围定义');

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headerRow = [];

  // 读取单层表头（索引2对应Excel第3行）
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
    dataStartRow: 1 // 数据从索引3开始（Excel第4行）
  };
}

// 处理营口和敬业 sheet

// 处理营口和敬业 sheet
function processMergedSheet(sheet, targetColumns, sheetName) {
  try {
    const { columns, dataStartRow } = parseMergedHeaders(sheet);
    
    // 构建列索引
    const colIndex = {};
    for (const [colName, fullPath] of Object.entries(targetColumns)) {
      const col = columns.find(c => c.fullPath === fullPath);
      if (!col) throw new Error(`找不到列: ${fullPath}`);
      colIndex[colName] = col.index;
    }

    // 处理数据汇总和明细
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const summary = {};
    const details = [];
    
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
      const orderWeight = formatNum(getValue('订单量') || 0);
      
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
          已船检: 0,
          已集港: 0,
          已发运: 0,
          订单量: 0,
          合同数: 0
        };
      }
      
      // 获取各重量值
      const unplanned = formatNum(getValue('未计划重量') || 0);
      const pendingSmelt = formatNum(getValue('待炼量') || 0);
      const pendingOutbound = formatNum(getValue('钢坯待出库') || 0);
      const unSmelted = formatNum(unplanned + pendingSmelt + pendingOutbound); // 未炼钢 = 三个字段之和
      const rolled = formatNum(getValue('已轧制') || 0);
      const inStock = formatNum(getValue('成品在库') || 0);
      const outbound = formatNum(getValue('出库结束') || 0);
      const shipped = formatNum(getValue('发运') || 0);
      
      // 累加汇总数据
      const target = summary[month][dock];
      target.未炼钢 = formatNum(target.未炼钢 + unSmelted);
      target.已轧制 = formatNum(target.已轧制 + rolled);
      target.已船检 = formatNum(target.已船检 + inStock + outbound);
      target.已集港 = formatNum(target.已集港 + outbound);
      target.已发运 = formatNum(target.已发运 + shipped);
      target.订单量 = formatNum(target.订单量 + orderWeight);
      target.合同数++;
      
      // 添加简化后的明细数据
      details.push({
        月份: month,
        码头: dock,
        合同号: contractNo,
        牌号材质: materialCode, // 统一字段名
        尺寸: size,
        订单量: orderWeight,
        未炼钢: unSmelted,
        已轧制: rolled,
        已船检: formatNum(inStock + outbound),
        已集港: outbound,
        已发运: shipped,
        数据来源: sheetName
      });
    }

    return { summary, details };

  } catch (error) {
    console.error(`处理${sheetName}失败:`, error);
    return { summary: {}, details: [] };
  }
}

// 处理兴澄 sheet
function processXingchengSheet(sheet) {
  try {
    const { columns, dataStartRow } = parseSingleHeader(sheet);
    
    // 目标列定义（添加牌号材质字段）
    const targetColumns = {
      '月份': '月份',
      '合同备注': '合同备注',
      '订货重量': '订货重量',
      '炼钢下线量': '炼钢下线量',
      '轧钢下线量': '轧钢下线量',
      '入库量': '入库量',
      '发货重量': '发货重量',
      '书面合同号': '书面合同号',
      '订货厚度': '订货厚度',
      '订货宽度': '订货宽度',
      '订货长度': '订货长度',
      '牌号（钢级）': '牌号（钢级）' // 新增牌号材质字段
    };

    // 构建列索引
    const colIndex = {};
    let allColumnsValid = true;
    const missingColumns = [];
    
    for (const [colName, header] of Object.entries(targetColumns)) {
      const col = columns.find(c => c.header === header);
      if (!col) {
        console.error(`❌ 列缺失: ${colName.padEnd(6)} -> ${header}`);
        missingColumns.push(colName);
        allColumnsValid = false;
        continue;
      }
      colIndex[colName] = col.index;
    }

    if (!allColumnsValid) {
      throw new Error(`缺少必要的列: ${missingColumns.join(', ')}`);
    }

    // 处理数据
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const summary = {};
    const details = [];
    
    const formatNum = (val) => {
      const num = Number(val);
      return isNaN(num) ? 0 : parseFloat(num.toFixed(3));
    };

    for (let r = dataStartRow; r <= range.e.r; r++) {
      const getValue = (colName) => {
        const cell = sheet[XLSX.utils.encode_cell({ r, c: colIndex[colName] })];
        return cell ? cell.v : null;
      };

      const monthRaw = getValue('月份');
      const remark = getValue('合同备注') || '';
      const orderWeight = formatNum(getValue('订货重量') || 0);
      const smelted = formatNum(getValue('炼钢下线量') || 0);
      const rolled = formatNum(getValue('轧钢下线量') || 0);
      const stored = formatNum(getValue('入库量') || 0);
      const shipped = formatNum(getValue('发货重量') || 0);
      const steelGrade = getValue('牌号（钢级）') || ''; // 获取牌号材质
      
      // 处理月份 - 去掉"月"字
      let month = String(monthRaw).replace('月', '').trim();
      if (!month || isNaN(month)) continue;
      
      // 处理码头 - 从合同备注提取
      const dock = remark.replace('入库按合约号堆放', '').replace(',', '').trim();
      if (!dock) continue;
      
      // 拼接尺寸（厚度*宽度*长度）
      const thickness = getValue('订货厚度') || '';
      const width = getValue('订货宽度') || '';
      const length = getValue('订货长度') || '';
      const size = [thickness, width, length]
        .map(val => val.toString().trim())
        .filter(Boolean)
        .join('*');
      
      // 初始化汇总结构
      if (!summary[month]) summary[month] = {};
      if (!summary[month][dock]) {
        summary[month][dock] = {
          未炼钢: 0,
          已轧制: 0,
          已船检: 0,
          已集港: 0,
          已发运: 0,
          订单量: 0,
          合同数: 0
        };
      }
      
      // 计算未炼钢（订单量 - 炼钢下线量）
      const unSmelted = formatNum(orderWeight - smelted);
      
      // 累加汇总数据
      const target = summary[month][dock];
      target.未炼钢 = formatNum(target.未炼钢 + unSmelted);
      target.已轧制 = formatNum(target.已轧制 + rolled);
      target.已船检 = formatNum(target.已船检 + stored);
      target.已集港 = formatNum(target.已集港 + stored);; // 兴澄没有出库结束数据
      target.已发运 = formatNum(target.已发运 + shipped);
      target.订单量 = formatNum(target.订单量 + orderWeight);
      target.合同数++;
      
      // 添加统一格式的明细数据
      details.push({
        月份: month,
        码头: dock,
        合同号: getValue('书面合同号'),
        牌号材质: steelGrade, // 添加牌号材质
        尺寸: size,
        订单量: orderWeight,
        未炼钢: unSmelted,
        已轧制: rolled,
        已船检: stored,
        已集港: 0,
        已发运: shipped,
        数据来源: '兴澄'
      });
    }

    return { summary, details };

  } catch (error) {
    console.error('处理兴澄失败:', error);
    return { summary: {}, details: [] };
  }
}


// 合并多个sheet的汇总数据
function mergeSummaries(summaries) {
  const mergedSummary = {};
  
  summaries.forEach(summary => {
    for (const month in summary) {
      if (!mergedSummary[month]) mergedSummary[month] = {};
      
      for (const dock in summary[month]) {
        if (!mergedSummary[month][dock]) {
          mergedSummary[month][dock] = { ...summary[month][dock] };
        } else {
          const target = mergedSummary[month][dock];
          const source = summary[month][dock];
          
          target.未炼钢 = formatNum(target.未炼钢 + source.未炼钢);
          target.已轧制 = formatNum(target.已轧制 + source.已轧制);
          target.已船检 = formatNum(target.已船检 + source.已船检);
          target.已集港 = formatNum(target.已集港 + source.已集港);
          target.已发运 = formatNum(target.已发运 + source.已发运);
          target.订单量 = formatNum(target.订单量 + source.订单量);
          target.合同数 += source.合同数;
        }
      }
    }
  });
  
  return mergedSummary;
}

// 辅助函数：格式化数字
function formatNum(val) {
  return parseFloat(Number(val).toFixed(3));
}

export async function zhongchuan(file) {
  try {
    const workbook = await readExcelFile(file);
    const allSummaries = [];
    const allDetails = [];
    
    // 处理营口 sheet
    if (workbook.SheetNames.includes('营口')) {
      const sheet = workbook.Sheets['营口'];
      const targetColumns = {
        '合同号': '合同号 > 合同号 > 合同号',
        '牌号/材质代码': '牌号/材质代码 > 牌号/材质代码 > 牌号/材质代码',
        '尺寸': '尺寸 > 尺寸 > 尺寸',
        '签订日期': '签订日期',
        '码头': '码头',
        '订单量': '订单量 > 订单量 > 重量', // 营口特有
        '未计划重量': '坯料设计 > 未计划 > 重量',
        '待炼量': '坯料进程 > 待炼量 > 重量',
        '钢坯待出库': '坯料进程 > 钢坯待出库 > 重量',
        '已轧制': '轧钢完成 > 轧钢完成 > 重量',
        '成品在库': '成品在库 > 成品在库 > 重量',
        '出库结束': '出库结束 > 出库结束 > 重量',
        '发运': '发运 > 发运 > 重量'
      };
      
      const { summary, details } = processMergedSheet(sheet, targetColumns, '营口');
      allSummaries.push(summary);
      allDetails.push(...details);
    } else {
      console.warn('工作簿中缺少"营口"工作表');
    }
    
    // 处理敬业 sheet
    if (workbook.SheetNames.includes('敬业')) {
      const sheet = workbook.Sheets['敬业'];
      const targetColumns = {
        '合同号': '合同号 > 合同号 > 合同号',
        '牌号/材质代码': '牌号/材质代码 > 牌号/材质代码 > 牌号/材质代码',
        '尺寸': '尺寸 > 尺寸 > 尺寸',
        '签订日期': '签订日期',
        '码头': '码头',
        '订单量': '订单量 > 订单量 > 重量', // 敬业特有
        '未计划重量': '坯料设计 > 未计划 > 重量',
        '待炼量': '坯料进程 > 待炼量 > 重量',
        '钢坯待出库': '坯料进程 > 钢坯待出库 > 重量',
        '已轧制': '轧钢完成 > 轧钢完成 > 重量',
        '成品在库': '成品在库 > 成品在库 > 重量',
        '出库结束': '出库结束 > 出库结束 > 重量',
        '发运': '发运 > 发运 > 重量'
      };
      
      const { summary, details } = processMergedSheet(sheet, targetColumns, '敬业');
      allSummaries.push(summary);
      allDetails.push(...details);
    } else {
      console.warn('工作簿中缺少"敬业"工作表');
    }
    
    // 处理兴澄 sheet
    // if (workbook.SheetNames.includes('兴澄')) {
    //   const sheet = workbook.Sheets['兴澄'];
    //   const { summary, details } = processXingchengSheet(sheet);
    //   allSummaries.push(summary);
    //   allDetails.push(...details);
    // } else {
    //   console.warn('工作簿中缺少"兴澄"工作表');
    // }
    
    // 合并所有汇总数据
    const mergedSummary = mergeSummaries(allSummaries);
    
    return {
      success: true,
      summary: mergedSummary,
      details: allDetails,
      sheetNames: workbook.SheetNames
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