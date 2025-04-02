// const XLSX = require('xlsx');
import * as XLSX from 'xlsx';
// const path = require('path');
// const { transaction } = require('./db/mysql_trans_110'); 
// const { version } = require('os');
async function processThirdSheet(workbook) {
    // const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[2];
    const sheet = workbook.Sheets[sheetName];
  
    // 读取标题行
    const headerRow = [];
    let col = 0;
    while (true) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      const cell = sheet[cellAddress];
      if (!cell) break;
      headerRow.push(cell.v.toString().trim()); // 去除前后空格
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
      grade: headerRow.indexOf('钢板牌号'),
      thickness: headerRow.indexOf('订厚(mm)'),
      width: headerRow.indexOf('订宽(mm)'),
      length: headerRow.indexOf('订长(mm)'),
      steelDeficit: headerRow.indexOf('炼钢欠重'),
      rollingDeficit: headerRow.indexOf('轧制欠重'),
      midStock: headerRow.indexOf('中间库重量'),
      productWeight: headerRow.indexOf('成品重量'),
      shippedWeight: headerRow.indexOf('准发重量'),
      contractDeficit: headerRow.indexOf('合同欠重')
    };
  
    // 设置数据范围（从第二行开始）
    const originalRange = XLSX.utils.decode_range(sheet['!ref']);
    originalRange.s.r = 1; // 0-based索引，第二行对应1
    sheet['!ref'] = XLSX.utils.encode_range(originalRange);
  
    // 转换数据
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
    // 处理数据逻辑
    const result = [];
    for (const row of jsonData) {
      // 跳过无效行（钢板牌号为空）
      if (!row[colIndex.grade]) continue;
  
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
  
      // 规格描述拼接（去掉单位保留纯数字）
      const thickness = toNum(row[colIndex.thickness]);
      const width = toNum(row[colIndex.width]);
      const length = toNum(row[colIndex.length]);
      const specDesc = `${thickness}*${width}*${length}`;
  
      // 计算逻辑
      result.push({
        规格描述: specDesc,
        牌号: row[colIndex.grade],
        未炼钢: steelDeficit,
        未轧制: rollingDeficit,
        未船检: midStock + rollingDeficit + productWeight - shippedWeight,
        未集港: contractDeficit,
        未发运: contractDeficit
      });
    }
    // for (var i = 0;i<result.length;i++){
    //  if(result[i].规格描述 == '12*2150*10800'){
    //     console.log(result[i])
    //     break;
    //  }



    // }
    // console.log(result[0])
    return result;
  }
  async function processFirstSheet(workbook) {
    // const workbook = XLSX.readFile(filePath);
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
      grade: headerRow.indexOf('标准牌号'),
      thickness: headerRow.indexOf('厚度'),
      width: headerRow.indexOf('宽度'),
      length: headerRow.indexOf('长度'),
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
  
    // 设置数据范围（假设数据从第二行开始）
    const originalRange = XLSX.utils.decode_range(sheet['!ref']);
    originalRange.s.r = 1; // 0-based索引，第二行开始
    sheet['!ref'] = XLSX.utils.encode_range(originalRange);
  
    // 转换数据
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
    // 处理数据逻辑
    const result = [];
    for (const row of jsonData) {
      // 跳过空行
      if (!row[colIndex.grade]) continue;
  
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
  
      // 计算逻辑
      const unsteeled = steel;
      const unrolled = steel + rolling;
      const uninspected = unrolled + finishing + heatTreatment + shape + material;
      const ungathered = uninspected + shipping + factory + wharf;
  
      // 规格描述拼接
      const thickness = toNum(row[colIndex.thickness]);
      const width = toNum(row[colIndex.width]);
      const length = toNum(row[colIndex.length]);
      const specDesc = `${thickness}*${width}*${length}`;
  
      result.push({
        规格描述: specDesc,
        牌号: row[colIndex.grade],
        未炼钢: unsteeled,
        未轧制: unrolled,
        未船检: uninspected,
        未集港: ungathered,
        未发运: toNum(row[colIndex.totalPending])
      });
    }
    // for(var i = 0 ;i<result.length;i++){
    // if(result[i]['规格描述'] == '10*2020*8560') {
    //     console.log(result[i])
    //     break;
    // }
    // }
    // console.log('result', result[0])
    return result;
  }

  function processExpression(expr) {

    var parts = expr.split('*');
    const firstPart = parseFloat(parts).toString(); // 核心修复点
    const restParts = parts.slice(1);
    return [firstPart, ...restParts].join('*');
  }

async function readExcel(workbook) {
  // const workbook = XLSX.readFile(filePath);
  // const sheet = workbook.Sheets[workbook.SheetNames[1]];
  const sheet = workbook.Sheets[workbook.SheetNames[1]];
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
    spec: headerRow.indexOf('规格描述'),
    orderWeight: headerRow.indexOf('订货重量(吨)'),
    status: headerRow.indexOf('合同生产状态'),
    netWeight: headerRow.indexOf('准发净重量'),
    shippedWeight: headerRow.indexOf('出厂重量（货权转移）'),
    grade: headerRow.indexOf('牌号')
  };
  console.log('colIndex', colIndex)
  const originalRange = XLSX.utils.decode_range(sheet['!ref']);
  originalRange.s.r = 1; // 0-based索引，第四行对应3
  sheet['!ref'] = XLSX.utils.encode_range(originalRange);
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
   // 处理数据逻辑
   const result = [];
   for (const row of jsonData) {
     if (!row[colIndex.spec] || !row[colIndex.grade]) continue; // 跳过关键字段为空的行
 
     // 数值类型转换
     const orderWeight = Number(row[colIndex.orderWeight]) || 0;
     const netWeight = Number(row[colIndex.netWeight]) || 0;
     const shippedWeight = Number(row[colIndex.shippedWeight]) || 0;
     const status = String(row[colIndex.status]).trim();
 
     // 条件判断
     const unsteeled = status === '41-[材料申请]有欠量' ? orderWeight : 0;
     
     const unrolled = ['41-[材料申请]有欠量', '43-[热轧]有欠量']
       .includes(status) ? orderWeight : 0;
     
     const uninspected = (status.startsWith('5') && status.includes('[准发]有欠量')) || 
       ['41-[材料申请]有欠量', '43-[热轧]有欠量'].includes(status) ? orderWeight : 0;
     
     const ungathered = netWeight - shippedWeight + uninspected;
     
     // 构建结果对象
     result.push({
       规格描述: processExpression(row[colIndex.spec]),
       牌号: row[colIndex.grade],
       未炼钢: unsteeled,
       未轧制: unrolled,
       未船检: uninspected,
       未集港: ungathered < 0 ? 0 : ungathered, 
       已发运: shippedWeight
     });
   }
   
//    console.log('result: ', result[0])
   return result;
}

// 转换金额字符串为数字
function parseAmount(amountStr) {
  const cleanAmount = amountStr.replace(/[^0-9.-]+/g, "");
  const amount = parseFloat(cleanAmount);
  if (!isNaN(amount)) return amount;
  throw new Error(`Invalid amount format: ${amountStr}`);
}

// 批量插入数据
// async function insertData(data) {
//   if (!data.length) {
//     console.log("没有需要插入的数据");
//     return;
//   }

//   const sqls = [];
//   const params = [];

//   // 构造 SQL 和参数
//   data.forEach(({ model, price, version }) => {
//     sqls.push("INSERT INTO baseprice (model, price, version) VALUES (?, ?, ?)");
//     params.push([model, price, version]);
//   });

//   // 调用事务函数
//   try {
//     const results = await transaction(sqls, params);
//     console.log("批量插入成功", results);
//   } catch (err) {
//     console.error("批量插入失败", err);
//   }
// }
async function readExcelFile(file) {
  // 获取原生File对象（处理不同UI库的差异）
  const rawFile = file.raw || file;
  
  // 添加类型检查
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
    reader.readAsArrayBuffer(rawFile);  // 确保传入原生File对象
  });
}
async function processSheet(workbook, sheetIndex) {
  try {
    const sheetName = workbook.SheetNames[sheetIndex];
    const processor = {
      0: processFirstSheet,
      1: readExcel,
      2: processThirdSheet
    }[sheetIndex];
    
    return await processor(workbook);
  } catch (error) {
    return { message: error.message };
  }
}

// 主函数
export async function tebian(file) {
    // const filePath = `C:/Users/xyy/Desktop/特变进度.xls`;
    try {
      const workbook = await readExcelFile(file);
      // 并行执行三个sheet处理（假设处理函数是同步的）
      // const [data1, data2, data3] = [
      //   readExcel(filePath),
      //   processFirstSheet(filePath),
      //   processThirdSheet(filePath)
      // ];
      const [data1, data2, data3] = await Promise.all([
        processSheet(workbook, 1), // 第二个sheet
        processSheet(workbook, 0), // 第一个sheet
        processSheet(workbook, 2)  // 第三个sheet
      ]);
      // 错误收集逻辑
      const errorCollector = (data, sheetNum) => {
        if (!data?.message) return null;
        const columns = data.message.split('列不存在')[0];
        return `第${sheetNum}个sheet的${columns}列缺失`;
      };
  
      const errors = [
        errorCollector(data1, 2),
        errorCollector(data2, 1),
        errorCollector(data3, 3)
      ].filter(Boolean);
  
      if (errors.length > 0) {
        return { 
          message: `${errors.join('，')}，请检查excel文件结构是否符合要求` 
        };
      }
      // console.log(data1[0])
      // 返回最终数据结构
      return {
        '涟钢': data1,
        '湘钢': data2,
        '首钢': data3
      };
  
    } catch (err) {
      console.error("操作失败：", err);
      return { message: `系统错误：${err.message}` };
    }
  }

// 执行主函数
// main();
