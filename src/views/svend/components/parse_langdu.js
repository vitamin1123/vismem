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

function parseChonggangSheet(sheet) {
  if (!sheet['!ref']) {
    throw new Error('无效的工作表，缺少范围定义');
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const headerRow = 0; // 表头在第一行
  const dataStartRow = 1; // 数据从第二行开始

  // 定义重钢表格的列名和对应的索引
  const chonggangColumns = {
    '合同月份': null,
    '牌号': null,
    '订厚(mm)': null,
    '订宽(mm)': null,
    '订长(mm)': null,
    '交货地点': null,
    '状态': null,
    '订重(t)': null, // 新增订重列
    '准发欠重': null,
    '已准发重(t)': null,
    '已出厂重(t)': null
  };

  // 查找各列的索引位置
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (cell) {
      const header = String(cell.v || '').trim();
      if (chonggangColumns.hasOwnProperty(header)) {
        chonggangColumns[header] = c;
      }
    }
  }

  // 检查是否所有必需的列都找到了
  const requiredColumns = ['合同月份', '牌号', '交货地点', '状态', '订重(t)', '准发欠重', '已准发重(t)', '已出厂重(t)'];
  for (const colName of requiredColumns) {
    if (chonggangColumns[colName] === null) {
      throw new Error(`找不到必需的列: ${colName}`);
    }
  }

  // 确保数值非负
  const formatNum = (val) => {
    const num = Number(val);
    if (isNaN(num) || num < 0) return 0;
    return parseFloat(num.toFixed(3));
  };

  const summary = {};
  const details = [];

  for (let r = dataStartRow; r <= range.e.r; r++) {
    // 获取单元格值
    const getValue = (colName) => {
      const colIndex = chonggangColumns[colName];
      const cell = sheet[XLSX.utils.encode_cell({ r, c: colIndex })];
      return cell ? cell.v : null;
    };

    const contractMonth = getValue('合同月份');
    const materialCode = getValue('牌号');
    const thickness = getValue('订厚(mm)');
    const width = getValue('订宽(mm)');
    const length = getValue('订长(mm)');
    const dock = getValue('交货地点');
    const status = getValue('状态');
    const totalWeight = formatNum(getValue('订重(t)'));
    
    // 校验关键字段
    if (!contractMonth || !materialCode || !dock) {
      continue;
    }
    
    // 提取月份
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
        未轧制: 0,
        已轧制: 0, // 新增已轧制字段
        已船检: 0,
        已集港: 0,
        已发运: 0,
        总订单量: 0,
        合同数: 0
      };
    }
    
    // 获取重量值
    const shortageWeight = formatNum(getValue('准发欠重'));
    const approvedWeight = formatNum(getValue('已准发重(t)'));
    const shippedWeight = formatNum(getValue('已出厂重(t)'));
    
    // 根据状态判断数据归属
    let unsteel = 0;
    let unrolled = 0;
    
    // 1. 未炼钢：状态包含"[材料申请]有欠量"
    if (status && status.includes('[材料申请]有欠量')) {
      unsteel = shortageWeight;
    }
    
    // 2. 未轧制：状态包含'[材料申请]有欠量'或'炼钢工序配料已满' (根据新要求修改)
    const unrolledStatuses = [
      '[材料申请]有欠量',
      '炼钢工序配料已满'
    ];
    
    if (status && unrolledStatuses.some(s => status.includes(s))) {
      unrolled = shortageWeight;
    }
    
    // 计算已轧制 = 总订重 - 未轧制
    const rolled = Math.max(0, totalWeight - unrolled);
    
    // 3. 已船检：所有行的"已准发重(t)"
    // 4. 已集港：所有行的"已准发重(t)"
    // 5. 已发运：所有行的"已出厂重(t)"
    
    // 累加汇总数据
    const target = summary[month][dock];
    target.未炼钢 += unsteel;
    target.未轧制 += unrolled;
    target.已轧制 += rolled; // 累加已轧制重量
    target.已船检 += approvedWeight;
    target.已集港 += approvedWeight;
    target.已发运 += shippedWeight;
    target.总订单量 += totalWeight;
    target.合同数++;

    // 添加明细数据
    details.push({
      月份: month,
      码头: dock.trim(),
      合同号: '', // 重钢数据中没有合同号
      牌号材质代码: materialCode,
      尺寸: `${thickness || ''}×${width || ''}×${length || ''}`,
      合同月份: contractMonth instanceof Date ? 
        contractMonth.toISOString().split('T')[0] : 
        contractMonth.toString().trim(),
      未计划重量: 0,
      未下炼钢重量: 0,
      未炼钢合计: unsteel,
      未轧制合计: unrolled,
      已轧制合计: rolled, // 新增已轧制字段
      成品在库重量: 0,
      出库结束重量: 0,
      已船检合计: approvedWeight,
      已集港: approvedWeight,
      已发运: shippedWeight,
      订重: totalWeight
    });
  }

  // 最后格式化所有数值
  for (const month of Object.keys(summary)) {
    for (const dock of Object.keys(summary[month])) {
      const target = summary[month][dock];
      target.未炼钢 = parseFloat(target.未炼钢.toFixed(3));
      target.未轧制 = parseFloat(target.未轧制.toFixed(3));
      target.已轧制 = parseFloat(target.已轧制.toFixed(3));
      target.已船检 = parseFloat(target.已船检.toFixed(3));
      target.已集港 = parseFloat(target.已集港.toFixed(3));
      target.已发运 = parseFloat(target.已发运.toFixed(3));
      target.总订单量 = parseFloat(target.总订单量.toFixed(3));
    }
  }

  return { summary, details };
}

export async function langdu(file) {
  try {
    // 1. 读取Excel文件
    const workbook = await readExcelFile(file);
    
    // 查找三个工作表：营口、重钢和敬业
    const yingkouSheetName = workbook.SheetNames.find(name => name.includes('营口'));
    const chonggangSheetName = workbook.SheetNames.find(name => name.includes('重钢'));
    const jingyeSheetName = workbook.SheetNames.find(name => name.includes('敬业')); // 新增敬业表
    
    if (!yingkouSheetName && !chonggangSheetName && !jingyeSheetName) {
      throw new Error('找不到营口、重钢或敬业工作表');
    }

    let yingkouResult = { summary: {}, details: [] };
    let chonggangResult = { summary: {}, details: [] };
    let jingyeResult = { summary: {}, details: [] }; // 新增敬业结果

    // 处理营口sheet
    if (yingkouSheetName) {
      const yingkouSheet = workbook.Sheets[yingkouSheetName];
      
      if (!yingkouSheet) {
        throw new Error(`找不到工作表: ${yingkouSheetName}`);
      }

      // 2. 解析表头
      const { columns, dataStartRow } = parseMergedHeaders(yingkouSheet);
      
      // 3. 定义需要提取的列（新增订单量）
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
        '已发运重量': '发运 > 发运 > 重量',
        '订单量': '订单量 > 订单量 > 重量' // 新增订单量
      };

      // 4. 构建列索引
      const colIndex = {};
      for (const [colName, fullPath] of Object.entries(targetColumns)) {
        const col = columns.find(c => c.fullPath === fullPath);
        if (!col) throw new Error(`找不到列: ${fullPath}`);
        colIndex[colName] = col.index;
      }

      // 5. 处理数据汇总和明细
      const range = XLSX.utils.decode_range(yingkouSheet['!ref']);
      
      // 数值处理函数（确保非负）
      const formatNum = (val) => {
        const num = Number(val);
        if (isNaN(num) || num < 0) return 0;
        return parseFloat(num.toFixed(3));
      };

      for (let r = dataStartRow; r <= range.e.r; r++) {
        // 获取单元格值
        const getValue = (colName) => {
          const cell = yingkouSheet[XLSX.utils.encode_cell({ r, c: colIndex[colName] })];
          return cell ? cell.v : null;
        };

        const contractNo = getValue('合同号');
        const materialCode = getValue('牌号/材质代码');
        const size = getValue('尺寸');
        const contractMonth = getValue('合同月份');
        const dock = getValue('码头');
        const orderWeight = formatNum(getValue('订单量')); // 新增订单量
        
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
        if (!yingkouResult.summary[month]) yingkouResult.summary[month] = {};
        if (!yingkouResult.summary[month][dock]) {
          yingkouResult.summary[month][dock] = {
            未炼钢: 0,
            已轧制: 0,
            已船检: 0,
            已集港: 0,
            已发运: 0,
            总订单量: 0,  // 新增总订单量
            合同数: 0
          };
        }
        
        // 获取各重量值（确保非负）
        const unplanned = formatNum(getValue('未计划重量'));
        const unsteeled = formatNum(getValue('未下炼钢重量'));
        const rolled = formatNum(getValue('轧钢完成重量'));
        const inStock = formatNum(getValue('成品在库重量'));
        const outbound = formatNum(getValue('出库结束重量'));
        const shipped = formatNum(getValue('已发运重量'));
        
        // 计算组合值（确保非负）
        const unsteelTotal = formatNum(unplanned + unsteeled); // 未炼钢 = 未计划 + 未下炼钢
        const inspected = formatNum(inStock + outbound);      // 已船检 = 成品在库 + 出库结束
        const gathered = outbound;                           // 已集港 = 出库结束
        
        // 累加汇总数据
        const target = yingkouResult.summary[month][dock];
        target.未炼钢 += unsteelTotal;
        target.已轧制 += rolled;
        target.已船检 += inspected;
        target.已集港 += gathered;
        target.已发运 += shipped;
        target.总订单量 += orderWeight;  // 累加订单量
        target.合同数++;

        // 添加明细数据
        yingkouResult.details.push({
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
          已发运: shipped,
          订单量: orderWeight  // 新增订单量
        });
      }

      // 最后格式化所有数值
      for (const month of Object.keys(yingkouResult.summary)) {
        for (const dock of Object.keys(yingkouResult.summary[month])) {
          const target = yingkouResult.summary[month][dock];
          target.未炼钢 = parseFloat(target.未炼钢.toFixed(3));
          target.已轧制 = parseFloat(target.已轧制.toFixed(3));
          target.已船检 = parseFloat(target.已船检.toFixed(3));
          target.已集港 = parseFloat(target.已集港.toFixed(3));
          target.已发运 = parseFloat(target.已发运.toFixed(3));
          target.总订单量 = parseFloat(target.总订单量.toFixed(3));
        }
      }
    }

    // 处理重钢sheet
    if (chonggangSheetName) {
      const chonggangSheet = workbook.Sheets[chonggangSheetName];
      
      if (!chonggangSheet) {
        throw new Error(`找不到工作表: ${chonggangSheetName}`);
      }

      chonggangResult = parseChonggangSheet(chonggangSheet);
    }

    // 处理敬业sheet - 新增部分
    if (jingyeSheetName) {
      const jingyeSheet = workbook.Sheets[jingyeSheetName];
      
      if (!jingyeSheet) {
        throw new Error(`找不到工作表: ${jingyeSheetName}`);
      }

      // 解析表头（复用营口逻辑）
      const { columns, dataStartRow } = parseMergedHeaders(jingyeSheet);
      
      // 定义需要提取的列（与营口相同）
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
        '已发运重量': '发运 > 发运 > 重量',
        '订单量': '订单量 > 订单量 > 重量'
      };

      // 构建列索引
      const colIndex = {};
      for (const [colName, fullPath] of Object.entries(targetColumns)) {
        const col = columns.find(c => c.fullPath === fullPath);
        if (!col) throw new Error(`找不到列: ${fullPath}`);
        colIndex[colName] = col.index;
      }

      // 处理数据汇总和明细（与营口相同）
      const range = XLSX.utils.decode_range(jingyeSheet['!ref']);
      
      const formatNum = (val) => {
        const num = Number(val);
        if (isNaN(num) || num < 0) return 0;
        return parseFloat(num.toFixed(3));
      };

      for (let r = dataStartRow; r <= range.e.r; r++) {
        const getValue = (colName) => {
          const cell = jingyeSheet[XLSX.utils.encode_cell({ r, c: colIndex[colName] })];
          return cell ? cell.v : null;
        };

        const contractNo = getValue('合同号');
        const materialCode = getValue('牌号/材质代码');
        const size = getValue('尺寸');
        const contractMonth = getValue('合同月份');
        const dock = getValue('码头');
        const orderWeight = formatNum(getValue('订单量'));
        
        if (!contractNo || !materialCode || !size || !contractMonth || !dock) {
          continue;
        }
        
        let month = null;
        if (typeof contractMonth === 'string') {
          const monthMatch = contractMonth.match(/^(\d{1,2})月?$/);
          if (monthMatch) {
            month = String(parseInt(monthMatch[1]));
          }
        } else if (contractMonth instanceof Date) {
          month = String(contractMonth.getMonth() + 1);
        }
        
        if (!month || !/^[1-9]|1[0-2]$/.test(month)) {
          continue;
        }
        
        if (typeof dock !== 'string' || dock.trim() === '') {
          continue;
        }
        
        if (!jingyeResult.summary[month]) jingyeResult.summary[month] = {};
        if (!jingyeResult.summary[month][dock]) {
          jingyeResult.summary[month][dock] = {
            未炼钢: 0,
            已轧制: 0,
            已船检: 0,
            已集港: 0,
            已发运: 0,
            总订单量: 0,
            合同数: 0
          };
        }
        
        const unplanned = formatNum(getValue('未计划重量'));
        const unsteeled = formatNum(getValue('未下炼钢重量'));
        const rolled = formatNum(getValue('轧钢完成重量'));
        const inStock = formatNum(getValue('成品在库重量'));
        const outbound = formatNum(getValue('出库结束重量'));
        const shipped = formatNum(getValue('已发运重量'));
        
        const unsteelTotal = formatNum(unplanned + unsteeled);
        const inspected = formatNum(inStock + outbound);
        const gathered = outbound;
        
        const target = jingyeResult.summary[month][dock];
        target.未炼钢 += unsteelTotal;
        target.已轧制 += rolled;
        target.已船检 += inspected;
        target.已集港 += gathered;
        target.已发运 += shipped;
        target.总订单量 += orderWeight;
        target.合同数++;

        jingyeResult.details.push({
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
          已发运: shipped,
          订单量: orderWeight
        });
      }

      // 格式化敬业汇总数据
      for (const month of Object.keys(jingyeResult.summary)) {
        for (const dock of Object.keys(jingyeResult.summary[month])) {
          const target = jingyeResult.summary[month][dock];
          target.未炼钢 = parseFloat(target.未炼钢.toFixed(3));
          target.已轧制 = parseFloat(target.已轧制.toFixed(3));
          target.已船检 = parseFloat(target.已船检.toFixed(3));
          target.已集港 = parseFloat(target.已集港.toFixed(3));
          target.已发运 = parseFloat(target.已发运.toFixed(3));
          target.总订单量 = parseFloat(target.总订单量.toFixed(3));
        }
      }
    }
    // 新增敬业处理结束

    // 合并三个sheet的数据
    const mergedSummary = {};
    const mergedDetails = [
      ...yingkouResult.details,
      ...chonggangResult.details,
      ...jingyeResult.details  // 添加敬业明细
    ];

    // 合并营口、重钢和敬业的summary
    const allMonths = new Set([
      ...Object.keys(yingkouResult.summary),
      ...Object.keys(chonggangResult.summary),
      ...Object.keys(jingyeResult.summary)  // 添加敬业月份
    ]);

    for (const month of allMonths) {
      mergedSummary[month] = {};
      
      // 获取所有码头
      const docks = new Set([
        ...(yingkouResult.summary[month] ? Object.keys(yingkouResult.summary[month]) : []),
        ...(chonggangResult.summary[month] ? Object.keys(chonggangResult.summary[month]) : []),
        ...(jingyeResult.summary[month] ? Object.keys(jingyeResult.summary[month]) : [])  // 添加敬业码头
      ]);
      
      for (const dock of docks) {
        mergedSummary[month][dock] = {
          未炼钢: 0,
          已轧制: 0,
          未轧制: 0,
          已船检: 0,
          已集港: 0,
          已发运: 0,
          总订单量: 0,
          合同数: 0
        };
        
        // 累加营口数据
        if (yingkouResult.summary[month] && yingkouResult.summary[month][dock]) {
          const ykData = yingkouResult.summary[month][dock];
          mergedSummary[month][dock].未炼钢 += ykData.未炼钢;
          mergedSummary[month][dock].已轧制 += ykData.已轧制;
          mergedSummary[month][dock].已船检 += ykData.已船检;
          mergedSummary[month][dock].已集港 += ykData.已集港;
          mergedSummary[month][dock].已发运 += ykData.已发运;
          mergedSummary[month][dock].总订单量 += ykData.总订单量;
          mergedSummary[month][dock].合同数 += ykData.合同数;
        }
        
        // 累加重钢数据
        if (chonggangResult.summary[month] && chonggangResult.summary[month][dock]) {
          const cgData = chonggangResult.summary[month][dock];
          mergedSummary[month][dock].未炼钢 += cgData.未炼钢;
          mergedSummary[month][dock].未轧制 += cgData.未轧制;
          mergedSummary[month][dock].已轧制 += cgData.已轧制;
          mergedSummary[month][dock].已船检 += cgData.已船检;
          mergedSummary[month][dock].已集港 += cgData.已集港;
          mergedSummary[month][dock].已发运 += cgData.已发运;
          mergedSummary[month][dock].总订单量 += cgData.总订单量;
          mergedSummary[month][dock].合同数 += cgData.合同数;
        }
        
        // 累加敬业数据
        if (jingyeResult.summary[month] && jingyeResult.summary[month][dock]) {
          const jyData = jingyeResult.summary[month][dock];
          mergedSummary[month][dock].未炼钢 += jyData.未炼钢;
          mergedSummary[month][dock].已轧制 += jyData.已轧制;
          mergedSummary[month][dock].已船检 += jyData.已船检;
          mergedSummary[month][dock].已集港 += jyData.已集港;
          mergedSummary[month][dock].已发运 += jyData.已发运;
          mergedSummary[month][dock].总订单量 += jyData.总订单量;
          mergedSummary[month][dock].合同数 += jyData.合同数;
        }
        
        // 格式化数字
        mergedSummary[month][dock].未炼钢 = parseFloat(mergedSummary[month][dock].未炼钢.toFixed(3));
        mergedSummary[month][dock].已轧制 = parseFloat(mergedSummary[month][dock].已轧制.toFixed(3));
        mergedSummary[month][dock].未轧制 = parseFloat(mergedSummary[month][dock].未轧制.toFixed(3));
        mergedSummary[month][dock].已船检 = parseFloat(mergedSummary[month][dock].已船检.toFixed(3));
        mergedSummary[month][dock].已集港 = parseFloat(mergedSummary[month][dock].已集港.toFixed(3));
        mergedSummary[month][dock].已发运 = parseFloat(mergedSummary[month][dock].已发运.toFixed(3));
        mergedSummary[month][dock].总订单量 = parseFloat(mergedSummary[month][dock].总订单量.toFixed(3));
      }
    }

    // 如果没有数据，抛出错误
    if (Object.keys(mergedSummary).length === 0 || mergedDetails.length === 0) {
      throw new Error('未找到有效数据，请检查文件格式是否符合要求');
    }

    return {
      success: true,
      summary: mergedSummary,
      details: mergedDetails,
      sheetNames: {
        yingkou: yingkouSheetName,
        chonggang: chonggangSheetName,
        jingye: jingyeSheetName  // 添加敬业表名
      }
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