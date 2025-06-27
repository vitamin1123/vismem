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
  const executionList = [];

  // 查找关键列索引（表头在第3行）
  const headerRow = 2;
  let orderMonthCol = -1;
  let dockCol = -1;
  let resourceNoCol = -1;
  let shippedCol = -1;
  let statusCol = -1;
  let orderWeightCol = -1;

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    const value = cell ? String(cell.v || '').trim() : '';
    
    if (value === '订货月') orderMonthCol = c;
    else if (value === '码头') dockCol = c;
    else if (value === '钢厂资源号') resourceNoCol = c;
    else if (value === '已发货') shippedCol = c;
    else if (value.includes('厂内生产状态')) statusCol = c;
    else if (value === '订货重量') orderWeightCol = c;
  }

  // 验证所有必要列
  const missingCols = [];
  if (orderMonthCol === -1) missingCols.push('订货月');
  if (dockCol === -1) missingCols.push('码头');
  if (resourceNoCol === -1) missingCols.push('钢厂资源号');
  if (shippedCol === -1) missingCols.push('已发货');
  if (statusCol === -1) missingCols.push('厂内生产状态');
  if (orderWeightCol === -1) missingCols.push('订货重量');
  
  if (missingCols.length > 0) {
    throw new Error(`执行中工作表缺少必要的列: ${missingCols.join(', ')}`);
  }

  // 读取所有数据行
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const resourceNoCell = sheet[XLSX.utils.encode_cell({ r, c: resourceNoCol })];
    if (!resourceNoCell) continue;

    const resourceNo = String(resourceNoCell.v || '').trim();
    if (!resourceNo) continue;

    const orderMonthCell = sheet[XLSX.utils.encode_cell({ r, c: orderMonthCol })];
    const dockCell = sheet[XLSX.utils.encode_cell({ r, c: dockCol })];
    const shippedCell = sheet[XLSX.utils.encode_cell({ r, c: shippedCol })];
    const statusCell = sheet[XLSX.utils.encode_cell({ r, c: statusCol })];
    const orderWeightCell = sheet[XLSX.utils.encode_cell({ r, c: orderWeightCol })];

    executionList.push({
      resourceNo,
      orderMonth: orderMonthCell ? orderMonthCell.v : null,
      dock: dockCell ? String(dockCell.v || '').trim() : null,
      shipped: shippedCell ? Number(shippedCell.v) || 0 : 0,
      status: statusCell ? String(statusCell.v || '').trim() : '',
      orderWeight: orderWeightCell ? Number(orderWeightCell.v) || 0 : 0
    });
  }

  return executionList;
}

function parseProductionSheet(sheet) {
  if (!sheet['!ref']) throw new Error('无效的生产进程工作表，缺少范围定义');

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const deficitMap = {};
  const details = [];
  let processedRows = 0;

  // 查找基础信息列索引（第一行）
  const baseHeaderRow = 0;
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
  const processHeaderRow = 1;
  const processCols = {
    steelMaking: { name: '炼钢工序', deficitCol: -1 },
    rolling: { name: '厚板轧制', deficitCol: -1 },
    inspection: { name: '材合', deficitCol: -1 },
    confirm: { name: '准发确认', deficitCol: -1 },
    complete: { name: '出厂完毕', deficitCol: -1 }
  };

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: processHeaderRow, c })];
    const value = cell ? String(cell.v || '').trim() : '';

    for (const [key, proc] of Object.entries(processCols)) {
      if (value === proc.name) {
        // 欠量在第三行的c+2位置
        const deficitCell = sheet[XLSX.utils.encode_cell({ r: processHeaderRow + 1, c: c + 2 })];
        if (deficitCell && String(deficitCell.v || '').trim() === '欠量') {
          proc.deficitCol = c + 2;
        }
        break;
      }
    }
  }

  // 处理数据行（从第四行开始）
  for (let r = processHeaderRow + 2; r <= range.e.r; r++) {
    const resourceNoCell = sheet[XLSX.utils.encode_cell({ r, c: resourceNoCol })];
    if (!resourceNoCell) continue;

    const resourceNo = String(resourceNoCell.v || '').trim();
    if (!resourceNo) continue;

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

    // 保存欠量信息
    deficitMap[resourceNo] = {
      steelDeficit,
      rollingDeficit,
      inspectionDeficit,
      portDeficit
    };

    // 添加到详情
    details.push({
      钢厂资源号: resourceNo,
      月份显示: '', // 将在主函数中填充
      码头: '',    // 将在主函数中填充
      钢种: steelGrade,
      订货厚度: thickness,
      订货宽度: width,
      订货长度: length,
      未炼钢: steelDeficit,
      未轧制: rollingDeficit,
      未船检: inspectionDeficit,
      未集港: portDeficit,
      来源: '生产进程'
    });

    processedRows++;
  }

  return { deficitMap, details, processedRows };
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

    // 处理执行中工作表 - 获取所有数据
    const executionSheet = workbook.Sheets['执行中'];
    const executionList = parseExecutionSheet(executionSheet);

    // 处理生产进程工作表 - 获取欠量映射和详情
    const productionSheet = workbook.Sheets['生产进程'];
    const { deficitMap, details, processedRows } = parseProductionSheet(productionSheet);
    result.stats.processedRows = processedRows;
    
    // 处理详情中的月份和码头信息
    const updatedDetails = details.map(detail => {
      const execItem = executionList.find(item => item.resourceNo === detail.钢厂资源号);
      if (execItem) {
        // 处理订货月格式
        let month;
        const orderMonth = execItem.orderMonth;
        if (typeof orderMonth === 'number') {
          if (orderMonth > 12) {
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
        
        return {
          ...detail,
          月份: month ? String(month) : '未知',
          月份显示: month ? `${month}月` : '未知月份',
          码头: execItem.dock || '未知',
          订货月份: typeof orderMonth === 'number' && orderMonth > 12
            ? new Date((orderMonth - 25569) * 86400 * 1000).toISOString().split('T')[0]
            : String(orderMonth)
        };
      }
      return detail;
    });
    result.details = updatedDetails;

    // 构建汇总数据 - 基于执行中工作表的所有数据
    executionList.forEach(execItem => {
      // 处理订货月格式
      let month;
      const orderMonth = execItem.orderMonth;
      if (typeof orderMonth === 'number') {
        if (orderMonth > 12) {
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
        console.warn(`资源号 ${execItem.resourceNo} 月份格式无效: ${orderMonth}`);
        return;
      }
      
      const monthKey = String(month);
      const dock = execItem.dock || '未知';
      
      // 初始化汇总结构
      if (!result.summary[monthKey]) {
        result.summary[monthKey] = {};
      }
      if (!result.summary[monthKey][dock]) {
        result.summary[monthKey][dock] = {
          已炼钢: 0,
          已轧制: 0,
          已船检: 0,
          已集港: 0,
          已发运: 0,
          合同数: 0
        };
      }
      
      const target = result.summary[monthKey][dock];
      target.合同数++;
      target.已发运 += execItem.shipped;
      
      // 获取该资源号的欠量信息（如果存在）
      const deficits = deficitMap[execItem.resourceNo] || {
        steelDeficit: 0,
        rollingDeficit: 0,
        inspectionDeficit: 0,
        portDeficit: 0
      };
      
      // 根据生产状态计算完成量
      if (execItem.status === '生产完毕') {
        target.已炼钢 += execItem.orderWeight;
        target.已轧制 += execItem.orderWeight;
        target.已船检 += execItem.orderWeight;
        target.已集港 += execItem.orderWeight;
      } else if (execItem.status === '生产中') {
        target.已炼钢 += execItem.orderWeight - deficits.steelDeficit;
        target.已轧制 += execItem.orderWeight - deficits.rollingDeficit;
        target.已船检 += execItem.orderWeight - deficits.inspectionDeficit;
        target.已集港 += execItem.orderWeight - deficits.portDeficit;
      }
    });

    if (Object.keys(result.summary).length === 0) {
      throw new Error('无有效汇总数据。可能原因:\n1. 没有找到匹配的数据\n2. 数据格式不正确');
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