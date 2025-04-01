import * as XLSX from 'xlsx';

async function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('Excel文件中没有工作表');
          }
          
          resolve(workbook);
        } catch (error) {
          reject(new Error(`解析Excel文件失败: ${error.message}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('读取文件失败'));
      };
      
      if (file instanceof Blob) {
        reader.readAsArrayBuffer(file);
      } else if (file.raw instanceof Blob) {
        reader.readAsArrayBuffer(file.raw);
      } else {
        reject(new Error('无效的文件对象，必须是Blob或包含raw属性的对象'));
      }
    } catch (error) {
      reject(error);
    }
  });
}

function parseHeaders(sheet) {
  if (!sheet || !sheet['!ref']) {
    throw new Error('无效的工作表');
  }

  try {
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const merges = sheet['!merges'] || [];
    const headers = [];

    // 1. 提取原始表头数据（假设表头在2-4行，0-based）
    for (let r = 2; r <= 4; r++) {
      const row = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        row.push(cell ? String(cell.v || '').trim() : '');
      }
      headers.push(row);
    }

    // 2. 处理合并单元格
    merges.forEach(merge => {
      if (merge.s.r >= 2 && merge.s.r <= 4) {
        const value = headers[merge.s.r - 2][merge.s.c];
        for (let r = merge.s.r; r <= merge.e.r; r++) {
          for (let c = merge.s.c; c <= merge.e.c; c++) {
            if (r >= 2 && r <= 4) {
              headers[r - 2][c] = value;
            }
          }
        }
      }
    });

    // 3. 构建列定义
    const columns = [];
    for (let c = 0; c < headers[0].length; c++) {
      const path = [
        headers[0][c],
        headers[1][c],
        headers[2][c]
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
  } catch (error) {
    throw new Error(`解析表头失败: ${error.message}`);
  }
}

export async function analyzeExcel(file) {
  try {
    console.log('开始解析Excel文件...');
    
    // 1. 读取文件
    const workbook = await readExcelFile(file);
    console.log('工作表列表:', workbook.SheetNames);
    
    // 2. 获取第一个工作表
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`找不到工作表: ${sheetName}`);
    }
    
    // 3. 解析表头
    console.log('开始解析表头...');
    const { columns } = parseHeaders(sheet);
    
    // 4. 打印表头结构
    console.log('==== 表头结构 ====');
    console.log('列号\t层级1\t层级2\t层级3\t完整路径');
    columns.forEach(col => {
      console.log(
        `${col.index}\t` +
        `${col.level1 || ''}\t` +
        `${col.level2 || ''}\t` +
        `${col.level3 || ''}\t` +
        `${col.fullPath}`
      );
    });
    
    // 5. 测试查找关键列
    const testColumns = [
      { name: '签订日期', path: ['签订日期'] },
      { name: '码头', path: ['码头'] },
      { name: '未炼钢', path: ['坯料设计', '未计划', '重量'] },
      { name: '轧钢完成', path: ['轧钢完成', '重量'] }
    ];
    
    console.log('\n==== 列查找测试 ====');
    testColumns.forEach(test => {
      const found = columns.find(col => 
        test.path.every((part, i) => col.path[i] === part)
      );
      
      console.log(
        `${test.name.padEnd(8)}: ` +
        (found ? `列 ${found.index} - ${found.fullPath}` : '未找到')
      );
    });
    
    return {
      success: true,
      sheetName,
      columns
    };
  } catch (error) {
    console.error('分析失败:', error);
    return {
      success: false,
      message: error.message
    };
  }
}