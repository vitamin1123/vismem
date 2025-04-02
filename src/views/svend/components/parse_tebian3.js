import * as XLSX from 'xlsx';

// 读取Excel文件的通用函数
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

// 处理第一张sheet（原湘钢数据）
async function processFirstSheet(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // 读取标题行
  const headerRow = [];
  let col = 0;
  while (true) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = sheet[cellAddress];
    if (!cell) break;
    headerRow.push(cell.v.toString().trim());
    col++;
  }

  // 检查必须存在的列
  const requiredColumns = [
    '标准牌号', '厚度', '宽度', '长度',
    '炼钢在库量', '轧钢在库量', '精整在库量',
    '热处理在库量', '形合在库量', '材合在库量',
    '准发在库量（33）', '出厂在库量', '出厂未到码头量',
    '总待交重量{订货量-已发货量（出厂码单）}'
  ];

  const missingColumns = requiredColumns.filter(col => !headerRow.includes(col));
  if (missingColumns.length > 0) {
    return { message: `${missingColumns.join(',')}列不存在，请检查` };
  }

  // 建立列索引映射
  const colIndex = {
    steelStock: headerRow.indexOf('炼钢在库量'),
    rollingStock: headerRow.indexOf('轧钢在库量'),
    finishingStock: headerRow.indexOf('精整在库量'),
    heatTreatmentStock: headerRow.indexOf('热处理在库量'),
    shapeStock: headerRow.indexOf('形合在库量'),
    materialStock: headerRow.indexOf('材合在库量'),
    shippingStock: headerRow.indexOf('准发在库量（33）'),
    factoryStock: headerRow.indexOf('出厂在库量'),
    wharfStock: headerRow.indexOf('出厂未到码头量'),
    totalPending: headerRow.indexOf('总待交重量{订货量-已发货量（出厂码单）}')
  };

  // 设置数据范围（从第二行开始）
  const originalRange = XLSX.utils.decode_range(sheet['!ref']);
  originalRange.s.r = 1;
  sheet['!ref'] = XLSX.utils.encode_range(originalRange);

  // 转换数据
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // 计算汇总值
  let unsteeled = 0;
  let unrolled = 0;
  let uninspected = 0;
  let ungathered = 0;
  let unsent = 0;

  for (const row of jsonData) {
    // 跳过空行
    if (!row[0]) continue;

    // 数值转换
    const toNum = (val) => Math.max(Number(val) || 0, 0);
    
    // 基础数值
    const steel = toNum(row[colIndex.steelStock]);
    const rolling = toNum(row[colIndex.rollingStock]);
    const finishing = toNum(row[colIndex.finishingStock]);
    const heatTreatment = toNum(row[colIndex.heatTreatmentStock]);
    const shape = toNum(row[colIndex.shapeStock]);
    const material = toNum(row[colIndex.materialStock]);
    const shipping = toNum(row[colIndex.shippingStock]);
    const factory = toNum(row[colIndex.factoryStock]);
    const wharf = toNum(row[colIndex.wharfStock]);

    // 累加计算
    unsteeled += steel;
    unrolled += steel + rolling;
    uninspected += steel + rolling + finishing + heatTreatment + shape + material;
    ungathered += uninspected + shipping + factory + wharf;
    unsent += toNum(row[colIndex.totalPending]);
  }

  return {
    未炼钢: unsteeled,
    未轧制: unrolled,
    未船检: uninspected,
    未集港: ungathered,
    未发运: unsent
  };
}

// 处理第二张sheet（原涟钢数据）
async function processSecondSheet(workbook) {
  const sheetName = workbook.SheetNames[1];
  const sheet = workbook.Sheets[sheetName];
  
  // 读取标题行
  const headerRow = [];
  let col = 0;
  while (true) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = sheet[cellAddress];
    if (!cell) break;
    headerRow.push(cell.v.toString());
    col++;
  }

  // 检查必须存在的列
  const requiredColumns = [
    '规格描述',
    '订货重量(吨)',
    '合同生产状态',
    '准发净重量',
    '出厂重量（货权转移）',
    '牌号'
  ];
  
  const missingColumns = requiredColumns.filter(col => !headerRow.includes(col));
  if (missingColumns.length > 0) {
    return { message: `${missingColumns.join(',')}列不存在，请检查` };
  }

  const colIndex = {
    orderWeight: headerRow.indexOf('订货重量(吨)'),
    status: headerRow.indexOf('合同生产状态'),
    netWeight: headerRow.indexOf('准发净重量'),
    shippedWeight: headerRow.indexOf('出厂重量（货权转移）')
  };

  // 设置数据范围（从第二行开始）
  const originalRange = XLSX.utils.decode_range(sheet['!ref']);
  originalRange.s.r = 1;
  sheet['!ref'] = XLSX.utils.encode_range(originalRange);

  // 转换数据
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 } );

  // 计算汇总值
  let unsteeled = 0;
  let unrolled = 0;
  let uninspected = 0;
  let ungathered = 0;
  let shipped = 0;

  for (const row of jsonData) {
    if (!row[0]) continue; // 跳过关键字段为空的行

    // 数值类型转换
    const orderWeight = Number(row[colIndex.orderWeight]) || 0;
    const netWeight = Number(row[colIndex.netWeight]) || 0;
    const shippedWeight = Number(row[colIndex.shippedWeight]) || 0;
    const status = String(row[colIndex.status]).trim();

    // 条件判断
    if (status === '41-[材料申请]有欠量') {
      unsteeled += orderWeight;
    }
    
    if (['41-[材料申请]有欠量', '43-[热轧]有欠量'].includes(status)) {
      unrolled += orderWeight;
    }
    
    if ((status.startsWith('5') && status.includes('[准发]有欠量')) || 
       ['41-[材料申请]有欠量', '43-[热轧]有欠量'].includes(status)) {
      uninspected += orderWeight;
    }
    
    const tempUngathered = netWeight - shippedWeight + uninspected;
    ungathered += tempUngathered < 0 ? 0 : tempUngathered;
    shipped += shippedWeight;
  }

  return {
    未炼钢: unsteeled,
    未轧制: unrolled,
    未船检: uninspected,
    未集港: ungathered,
    已发运: shipped
  };
}

// 处理第三张sheet（原首钢数据）
async function processThirdSheet(workbook) {
  const sheetName = workbook.SheetNames[2];
  const sheet = workbook.Sheets[sheetName];
  
  // 读取标题行
  const headerRow = [];
  let col = 0;
  while (true) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = sheet[cellAddress];
    if (!cell) break;
    headerRow.push(cell.v.toString().trim());
    col++;
  }

  // 检查必须存在的列
  const requiredColumns = [
    '钢板牌号', '订厚(mm)', '订宽(mm)', '订长(mm)',
    '炼钢欠重', '轧制欠重', '中间库重量',
    '成品重量', '准发重量', '合同欠重'
  ];

  const missingColumns = requiredColumns.filter(col => !headerRow.includes(col));
  if (missingColumns.length > 0) {
    return { message: `${missingColumns.join(',')}列不存在，请检查` };
  }

  // 建立列索引映射
  const colIndex = {
    steelDeficit: headerRow.indexOf('炼钢欠重'),
    rollingDeficit: headerRow.indexOf('轧制欠重'),
    midStock: headerRow.indexOf('中间库重量'),
    productWeight: headerRow.indexOf('成品重量'),
    shippedWeight: headerRow.indexOf('准发重量'),
    contractDeficit: headerRow.indexOf('合同欠重')
  };

  // 设置数据范围（从第二行开始）
  const originalRange = XLSX.utils.decode_range(sheet['!ref']);
  originalRange.s.r = 1;
  sheet['!ref'] = XLSX.utils.encode_range(originalRange);

  // 转换数据
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // 计算汇总值
  let unsteeled = 0;
  let unrolled = 0;
  let uninspected = 0;
  let ungathered = 0;
  let unsent = 0;

  for (const row of jsonData) {
    if (!row[0]) continue; // 跳过钢板牌号为空的记录

    // 数值转换函数（处理负数）
    const toNum = (val) => {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    // 基础数值
    const steelDeficit = toNum(row[colIndex.steelDeficit]);
    const rollingDeficit = toNum(row[colIndex.rollingDeficit]);
    const midStock = toNum(row[colIndex.midStock]);
    const productWeight = toNum(row[colIndex.productWeight]);
    const shippedWeight = toNum(row[colIndex.shippedWeight]);
    const contractDeficit = toNum(row[colIndex.contractDeficit]);

    // 累加计算
    unsteeled += steelDeficit;
    unrolled += rollingDeficit;
    uninspected += midStock + rollingDeficit + productWeight - shippedWeight;
    ungathered += contractDeficit;
    unsent += contractDeficit;
  }

  return {
    未炼钢: unsteeled,
    未轧制: unrolled,
    未船检: uninspected,
    未集港: ungathered,
    未发运: unsent
  };
}

// 主函数
export async function tebian(file) {
  try {
    const workbook = await readExcelFile(file);
    
    // 检查sheet数量
    if (workbook.SheetNames.length < 3) {
      return { message: 'Excel文件必须包含至少3个sheet' };
    }

    // 处理三个sheet
    const result = {
      [workbook.SheetNames[0]]: await processFirstSheet(workbook),
      [workbook.SheetNames[1]]: await processSecondSheet(workbook),
      [workbook.SheetNames[2]]: await processThirdSheet(workbook)
    };

    // 检查是否有错误消息
    for (const sheetName in result) {
      if (result[sheetName].message) {
        return { message: `处理${sheetName}时出错: ${result[sheetName].message}` };
      }
    }

    return result;

  } catch (err) {
    console.error("处理失败：", err);
    return { message: `系统错误：${err.message}` };
  }
}