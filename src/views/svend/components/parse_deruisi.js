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

function parseExecutionSheet(sheet) {
  if (!sheet['!ref']) throw new Error('无效的执行中工作表，缺少范围定义');

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const data = {};

  // 查找关键列索引
  let orderMonthCol = -1;
  let dockCol = -1;
  let resourceNoCol = -1;
  let shippedCol = -1;

  // 查找表头行（假设在第三行）
  const headerRow = 2; // Excel第3行
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    const value = cell ? String(cell.v || '').trim() : '';
    
    if (value === '订货月') orderMonthCol = c;
    else if (value === '码头') dockCol = c;
    else if (value === '钢厂资源号') resourceNoCol = c;
    else if (value === '已发货') shippedCol = c;
  }

  if (orderMonthCol === -1 || dockCol === -1 || resourceNoCol === -1 || shippedCol === -1) {
    throw new Error('执行中工作表缺少必要的列：订货月、码头、钢厂资源号或已发货');
  }

  // 读取数据行
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const resourceNoCell = sheet[XLSX.utils.encode_cell({ r, c: resourceNoCol })];
    if (!resourceNoCell) continue;

    const resourceNo = String(resourceNoCell.v || '').trim();
    if (!resourceNo) continue;

    const orderMonthCell = sheet[XLSX.utils.encode_cell({ r, c: orderMonthCol })];
    const dockCell = sheet[XLSX.utils.encode_cell({ r, c: dockCol })];
    const shippedCell = sheet[XLSX.utils.encode_cell({ r, c: shippedCol })];

    data[resourceNo] = {
      orderMonth: orderMonthCell ? orderMonthCell.v : null,
      dock: dockCell ? String(dockCell.v || '').trim() : null,
      shipped: shippedCell ? Number(shippedCell.v) || 0 : 0
    };
  }

  return data;
}

function parseProductionSheet(sheet, executionData) {
  if (!sheet['!ref']) throw new Error('无效的生产进程工作表，缺少范围定义');

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const result = {
    summary: {},
    details: [],
    processedRows: 0
  };

  // 查找基础信息列索引（第一行）
  const baseHeaderRow = 0; // Excel第1行
  let companyCol = -1;
  let resourceNoCol = -1;
  let steelGradeCol = -1;
  let specCol = -1;

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: baseHeaderRow, c })];
    const value = cell ? String(cell.v || '').trim() : '';
    
    if (value === '公司别') companyCol = c;
    else if (value === '钢厂资源号') resourceNoCol = c;
    else if (value === '钢种') steelGradeCol = c;
    else if (value === '规格') specCol = c;
  }

  // 查找工序列索引（第二行）
  const processHeaderRow = 1; // Excel第2行
  const processCols = {
    steelMaking: { name: '炼钢工序', col: -1, deficitCol: -1 },
    rolling: { name: '厚板轧制', col: -1, deficitCol: -1 },
    inspection: { name: '材合', col: -1, deficitCol: -1 },
    confirm: { name: '准发确认', col: -1, deficitCol: -1 },
    complete: { name: '出厂完毕', col: -1, deficitCol: -1 }
  };

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: processHeaderRow, c })];
    const value = cell ? String(cell.v || '').trim() : '';

    for (const [key, proc] of Object.entries(processCols)) {
      if (value === proc.name) {
        proc.col = c;
        // 欠量在第三行的c+2位置
        const deficitCell = sheet[XLSX.utils.encode_cell({ r: processHeaderRow + 1, c: c + 2 })];
        if (deficitCell && String(deficitCell.v || '').trim() === '欠量') {
          proc.deficitCol = c + 2;
        }
        break;
      }
    }
  }

  // 验证所有必要列
  const missingCols = [];
  if (companyCol === -1) missingCols.push('公司别');
  if (resourceNoCol === -1) missingCols.push('钢厂资源号');
  if (steelGradeCol === -1) missingCols.push('钢种');
  if (specCol === -1) missingCols.push('规格');
  
  for (const [key, proc] of Object.entries(processCols)) {
    if (proc.deficitCol === -1) {
      missingCols.push(`${proc.name}>欠量`);
    }
  }

  if (missingCols.length > 0) {
    throw new Error(`生产进程工作表缺少必要的列: ${missingCols.join(', ')}`);
  }

  // 处理数据行（从第四行开始）
  for (let r = processHeaderRow + 2; r <= range.e.r; r++) {
    const resourceNoCell = sheet[XLSX.utils.encode_cell({ r, c: resourceNoCol })];
    if (!resourceNoCell) continue;

    const resourceNo = String(resourceNoCell.v || '').trim();
    if (!resourceNo || !executionData[resourceNo]) continue;

    const execInfo = executionData[resourceNo];
    const companyCell = sheet[XLSX.utils.encode_cell({ r, c: companyCol })];
    const steelGradeCell = sheet[XLSX.utils.encode_cell({ r, c: steelGradeCol })];
    const specCell = sheet[XLSX.utils.encode_cell({ r, c: specCol })];
    
    const company = companyCell ? String(companyCell.v || '').trim() : '';
    const steelGrade = steelGradeCell ? String(steelGradeCell.v || '').trim() : '';
    const spec = specCell ? String(specCell.v || '').trim() : '';
    
    // 解析规格
    const specParts = spec.split('*').map(part => parseFloat(part.trim()));
    const thickness = specParts.length > 0 ? specParts[0] : 0;
    const width = specParts.length > 1 ? specParts[1] : 0;
    const length = specParts.length > 2 ? specParts[2] : 0;

    // 获取各工序欠量值
    const getDeficit = (col) => {
      if (col === -1) return 0;
      const cell = sheet[XLSX.utils.encode_cell({ r, c: col })];
      return cell ? Number(cell.v) || 0 : 0;
    };

    const steelDeficit = getDeficit(processCols.steelMaking.deficitCol);
    const rollingDeficit = getDeficit(processCols.rolling.deficitCol);
    const inspectionDeficit = getDeficit(processCols.inspection.deficitCol);
    
    // 根据公司别确定未集港值
    let portDeficit = 0;
    if (company.includes('宝山') || company.includes('湛江')) {
      portDeficit = getDeficit(processCols.confirm.deficitCol);
    } else if (company.includes('日照')) {
      portDeficit = getDeficit(processCols.complete.deficitCol);
    }

    // 处理订货月格式
    let month;
    const orderMonth = execInfo.orderMonth;
    if (typeof orderMonth === 'number') {
      if (orderMonth > 12) {
        // Excel日期格式
        const utcDays = Math.floor(orderMonth - 25569);
        const date = new Date(utcDays * 86400 * 1000);
        month = date.getMonth() + 1;
      } else {
        month = Math.floor(orderMonth);
      }
    } else if (typeof orderMonth === 'string') {
      const match = orderMonth.match(/(\d{1,2})月?/);
      month = match ? parseInt(match[1]) : null;
    }

    if (!month || month < 1 || month > 12) {
      console.warn(`行${r + 1} 月份格式无效: ${orderMonth}`);
      continue;
    }

    const monthKey = String(month);
    const dock = execInfo.dock || '未知';

    // 添加到汇总
    result.summary[monthKey] = result.summary[monthKey] || {};
    result.summary[monthKey][dock] = result.summary[monthKey][dock] || {
      未炼钢: 0, 未轧制: 0, 未船检: 0,
      未集港: 0, 已发运: 0, 合同数: 0
    };

    const target = result.summary[monthKey][dock];
    target.未炼钢 += steelDeficit;
    target.未轧制 += rollingDeficit;
    target.未船检 += inspectionDeficit;
    target.未集港 += portDeficit;
    target.已发运 += execInfo.shipped;
    
    target.合同数++;

    // 添加到详情
    result.details.push({
      月份: monthKey,
      月份显示: `${month}月`,
      码头: dock,
      钢种: steelGrade,
      订货厚度: thickness,
      订货宽度: width,
      订货长度: length,
      订货月份: typeof orderMonth === 'number' && orderMonth > 12
        ? new Date((orderMonth - 25569) * 86400 * 1000).toISOString().split('T')[0]
        : String(orderMonth),
      未炼钢: steelDeficit,
      未轧制: rollingDeficit,
      未船检: inspectionDeficit,
      未集港: portDeficit,
      已发运: execInfo.shipped,
      来源: '生产进程'
    });

    result.processedRows++;
  }

  if (result.processedRows === 0) {
    throw new Error('无有效数据处理。可能原因:\n1. 数据起始行设置错误\n2. 关键字段值为空\n3. 日期格式不匹配\n4. 钢厂资源号匹配失败');
  }

  return result;
}

export async function deruisi(file) {
  try {
    const workbook = await readExcelFile(file);
    const result = {
      success: true,
      summary: {},
      details: [],
      stats: { processedRows: 0 }
    };

    // 检查必要的工作表
    if (!workbook.SheetNames.includes('执行中') || !workbook.SheetNames.includes('生产进程')) {
      throw new Error('Excel文件中必须包含"执行中"和"生产进程"工作表');
    }

    // 处理执行中工作表
    const executionSheet = workbook.Sheets['执行中'];
    const executionData = parseExecutionSheet(executionSheet);

    // 处理生产进程工作表
    const productionSheet = workbook.Sheets['生产进程'];
    const { summary, details, processedRows } = parseProductionSheet(productionSheet, executionData);

    // 合并结果
    Object.keys(summary).forEach(month => {
      result.summary[month] = result.summary[month] || {};
      Object.keys(summary[month]).forEach(dock => {
        result.summary[month][dock] = result.summary[month][dock] || {
          未炼钢: 0, 未轧制: 0, 未船检: 0,
          未集港: 0, 已发运: 0, 合同数: 0
        };
        
        Object.keys(summary[month][dock]).forEach(key => {
          result.summary[month][dock][key] += summary[month][dock][key];
        });
      });
    });
    result.details = details;
    result.stats.processedRows = processedRows;

    if (result.stats.processedRows === 0) {
      throw new Error('无有效数据处理。可能原因:\n1. 没有找到匹配的数据\n2. 数据格式不正确');
    }

    return result;

  } catch (error) {
    console.error('处理失败:', error);
    return {
      success: false,
      message: error.message,
      error: error.stack
    };
  }
}