import { app, session } from 'electron';
import fs from 'fs';
import path from 'path';

// 定义 cookie 文件路径
const COOKIES_FILE = path.join(app.getPath('userData'), 'bilibili-cookies.json');

/**
 * 保存 cookies 到文件
 * @returns {Promise<boolean>} 保存结果
 */
export async function saveCookiesToFile() {
  try {
    const cookies = await session.defaultSession.cookies.get({});
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies), 'utf8');
    console.log('Cookies set success');
    return true;
  } catch (error) {
    console.error('save cookies failed:', error);
    return false;
  }
}

/**
 * 从文件加载 cookies 到 session
 * @returns {Promise<boolean>} 加载结果
 */
export async function loadCookiesFromFile() {
  try {
    if (!fs.existsSync(COOKIES_FILE)) {
      console.log('Cookies not exist');
      return false;
    }

    const cookiesData = fs.readFileSync(COOKIES_FILE, 'utf8');
    const cookies = JSON.parse(cookiesData);

    // 设置 cookies 到 session
    for (const cookie of cookies) {
      try {
        // 构造正确的URL
        const protocol = cookie.secure ? 'https://' : 'http://';
        const cookieUrl = `${protocol}${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}${cookie.path}`;

        // 创建新的cookie对象，不包含domain
        const cookieObj = {
          url: cookieUrl,
          name: cookie.name,
          value: cookie.value,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: cookie.expirationDate
        };

        await session.defaultSession.cookies.set(cookieObj);
      } catch (err) {
        console.error(`set cookie ${cookie.name} failed:`, err);
      }
    }

    console.log('Cookies success');
    return true;
  } catch (error) {
    console.error('get cookies failed:', error);
    return false;
  }
}

/**
 * 清除所有 cookies
 * @returns {Promise<boolean>} 清除结果
 */
export async function clearAllCookies() {
  try {
    await session.defaultSession.clearStorageData({
      storages: ['cookies']
    });

    // 删除保存的 cookie 文件
    if (fs.existsSync(COOKIES_FILE)) {
      fs.unlinkSync(COOKIES_FILE);
    }

    console.log('Cookies clear');
    return true;
  } catch (error) {
    console.error('clear cookies failed:', error);
    return false;
  }
}

/**
 * 获取当前所有 cookies
 * @returns {Promise<Object|null>} 以对象形式返回的 cookies
 */
export async function getCurrentCookies() {
  try {
    const cookies = await session.defaultSession.cookies.get({});

    // 转换为对象格式方便使用
    const cookieObj = {};
    cookies.forEach(cookie => {
      cookieObj[cookie.name] = cookie.value;
    });

    return cookieObj;
  } catch (error) {
    console.error('get cookies failed:', error);
    return null;
  }
}

/**
 * 提取 cookies 拼接为请求用的字符串格式
 * @returns {Promise<string>} cookies 字符串
 */
export async function getCookieString() {
  try {
    const cookies = await session.defaultSession.cookies.get({});

    return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  } catch (error) {
    console.error('get cookie string failed:', error);
    return '';
  }
}

/**
 * 检查是否已登录（通过检查 SESSDATA 和 bili_jct 是否存在）
 * @returns {Promise<boolean>} 登录状态
 */
export async function isLoggedIn() {
  try {
    const cookieObj = await getCurrentCookies();
    return !!(cookieObj && cookieObj.SESSDATA && cookieObj.bili_jct);
  } catch (error) {
    console.error('check login status failed:', error);
    return false;
  }
}

/**
 * 手动设置B站登录cookies
 * @param {Object} cookieData 包含DedeUserID、DedeUserID__ckMd5、Expires、SESSDATA、bili_jct等字段的对象
 * @returns {Promise<boolean>} 设置结果
 */
export async function setCookies(cookieData) {
  try {
    // 定义cookie配置
    const cookiesToSet = [
      {
        url: 'https://www.bilibili.com', // 使用完整URL而不是domain
        name: 'DedeUserID',
        value: cookieData.DedeUserID,
        path: '/',
        secure: true,
        httpOnly: false,
        expirationDate: cookieData.Expires ? parseInt(cookieData.Expires) : undefined
      },
      {
        url: 'https://www.bilibili.com',
        name: 'DedeUserID__ckMd5',
        value: cookieData.DedeUserID__ckMd5,
        path: '/',
        secure: true,
        httpOnly: false,
        expirationDate: cookieData.Expires ? parseInt(cookieData.Expires) : undefined
      },
      {
        url: 'https://www.bilibili.com',
        name: 'SESSDATA',
        value: cookieData.SESSDATA,
        path: '/',
        secure: true,
        httpOnly: true,
        expirationDate: cookieData.Expires ? parseInt(cookieData.Expires) : undefined
      },
      {
        url: 'https://www.bilibili.com',
        name: 'bili_jct',
        value: cookieData.bili_jct,
        path: '/',
        secure: true,
        httpOnly: false,
        expirationDate: cookieData.Expires ? parseInt(cookieData.Expires) : undefined
      }
    ];

    // 逐个设置cookie
    for (const cookie of cookiesToSet) {
      if (cookie.value) {
        await session.defaultSession.cookies.set(cookie);
      }
    }

    // 保存cookies到文件
    await saveCookiesToFile();

    console.log('Cookies set success');
    return true;
  } catch (error) {
    console.error('set cookies error:', error);
    return false;
  }
}
