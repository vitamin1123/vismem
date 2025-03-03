const Koa = require('koa');
const app = new Koa();
const Router = require('koa-router');
const https = require('https');
const fs = require('fs');
const path = require('path');
const koaStatic = require('koa-static');
const historyFallback = require('connect-history-api-fallback');
const koaConnect = require('koa-connect');
const { koaBody } = require('koa-body');
const jwt1 = require('jsonwebtoken');
const base64 = require('base-64');
const crypto = require('crypto');
const FileType = require('file-type'); 
const att = require('./controller/Attendance')
const router = new Router();

// 静态文件路径
const staticPath = path.join('D:/mp/dist');
const JWT_SECRET = '64beb0a3-66b3-69df-eaad-f1abc5fcc316'
// 使用 koa-body 解析请求体
// app.use(koaBody({
//   multipart: true, // 支持文件上传
//   formidable: {
//     maxFileSize: 200 * 1024 * 1024, // 设置最大文件大小（默认 200MB）
//   },
// }));
app.use(koaBody({
  multipart: true, // 支持文件上传
  formidable: {
    maxFileSize: 10 * 1024 * 1024, // 设置最大文件大小（默认 10MB）
    uploadDir: path.join('D:/mp/', 'uploads'), // 文件上传目录
    keepExtensions: true, // 保留文件扩展名
  },
}));

// 支持前端路由的历史模式
app.use(koaConnect(historyFallback({ verbose: true })));

// 使用 koa-static 中间件处理静态文件请求
app.use(koaStatic(staticPath));

// 使用路由
app.use(router.routes());
app.use(router.allowedMethods());

// HTTPS 配置
const pfxPath = 'D:/证书/newPfxFile.pfx';
const pfxPassword = '@1234.com';
const options = {
  pfx: fs.readFileSync(pfxPath),
  passphrase: pfxPassword,
};

// 启动 HTTPS 服务器
const PORT = process.env.PORT || 8081;
https.createServer(options, app.callback()).listen(PORT, () => {
  console.log(`HTTPS server is running on port ${PORT}`);
});

const tokenVerify = async (ctx, next) => {
  const authHeader = ctx.headers['authorization'];
  console.log('看看请求头：',authHeader)
  if (!authHeader) {
    ctx.status = 401;
    ctx.body = { code: 401, message: '未提供 token' };
    return;
  }

  const token = authHeader.split(' ')[1]; // Bearer token格式
  try {
    const decoded = jwt1.verify(token, JWT_SECRET); // 验证 token
    console.log('看看解码：',decoded)
    ctx.state.user = decoded; // 将用户信息存储在 ctx.state 中
    await next(); // 继续处理后续逻辑
  } catch (err) {
    console.error('Token 验证失败：', err);
    ctx.status = 403; // token 无效
    ctx.body = { code: 403, message: 'token 无效或已过期' };
  }
};

// 登录接口
router.post('/api/sso/login', async (ctx, next) => {
  const { name, password, user } = ctx.request.body;
  console.log('sso: ', name, password, user);
  if (!user) {
    ctx.status = 400;
    ctx.body = {
      code: 400,
      message: '用户名和密码不能为空',
    };
    return;
  }
  try {
    const secret = JWT_SECRET;
    const hash = crypto
      .createHmac('sha256', secret)
      .update(base64.decode(password))
      .digest('hex');
    const hashedPassword = await att.getPwd(name);
    console.log('hashedPassword:', hashedPassword);
    if (hashedPassword.length > 0 && hashedPassword[0]['password'] === hash) {
      const token = jwt1.sign({ uid: user }, JWT_SECRET, { expiresIn: '72000s' });

      ctx.body = {
        code: 200,
        message: '登录成功',
        data: {
          code: 0,
          token: token,
          name: user,
        },
      };
    } else {
      ctx.status = 401; // 未授权
      ctx.body = {
        code: 401,
        message: '用户名或密码错误',
      };
    }
  } catch (error) {
    ctx.status = 500; // 服务器内部错误
    ctx.body = {
      code: 500,
      message: '服务器错误',
    };
    console.error('Error during login:', error);
  }
});

router.post ('/api/get_vismem' ,tokenVerify,async (ctx, next) => {
  const user = ctx.state.user;
  console.log('usercode: ',user.uid)
  // const res = await Restuser.getUserName(usercode)
  // console.log('res: ',res)
  ctx.body = {
    "code": 0,
    "userCode": user.uid,
    // "userName": res.length > 0 ? res[0]['username'] : '',
  }
});

router.post('/api/submit_post', async (ctx, next) => {
  const { content, location } = ctx.request.body; // 获取文本内容和定位信息
  const { fields, files } = ctx.request.body;
  const user = ctx.state.user.uid;
  const uploadedFiles = files.files;
  try {
    if (Array.isArray(uploadedFiles)) {
        uploadedFiles.forEach((file, index) => {
          const oldPath = file.path;
          const newPath = path.join('D:/mp/', 'uploads', file.name);
  
          // 移动文件到目标目录
          fs.rename(oldPath, newPath, (err) => {
            if (err) {
              console.error('移动文件失败:', err);
            } else {
              console.log(`文件 ${file.name} 已保存到 ${newPath}`);
            }
          });
        });
      } else if (uploadedFiles) {
        const oldPath = uploadedFiles.path;
        const newPath = path.join('D:/mp/', 'uploads', uploadedFiles.name);
  
        // 移动文件到目标目录
        fs.rename(oldPath, newPath, (err) => {
          if (err) {
            console.error('移动文件失败:', err);
          } else {
            console.log(`文件 ${uploadedFiles.name} 已保存到 ${newPath}`);
          }
        });
      }

    // 返回成功响应
    ctx.body = {
      code: 0,
      message: '提交成功',
      data: {
        content,
        location,
        
      },
    };
  } catch (error) {
    console.error('提交失败:', error);
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: '提交失败，请重试',
    };
  }
});

