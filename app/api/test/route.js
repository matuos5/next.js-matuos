import axios from 'axios';

const response = await axios.post(
  'https://snaptik.app/abc2.php',
  '------WebKitFormBoundaryJS7G2eJPBusA2onQ\nContent-Disposition: form-data; name="url"\n\nhttps://vt.tiktok.com/ZSDMLYvBQ/\n------WebKitFormBoundaryJS7G2eJPBusA2onQ\nContent-Disposition: form-data; name="lang"\n\nar2\n------WebKitFormBoundaryJS7G2eJPBusA2onQ\nContent-Disposition: form-data; name="token"\n\neyMTc1NzkxNjA1Nw==c\n------WebKitFormBoundaryJS7G2eJPBusA2onQ--\n',
  {
    headers: {
      'Host': 'snaptik.app',
      'Connection': 'keep-alive',
      'Content-Length': '371',
      'sec-ch-ua-platform': '"Android"',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36',
      'sec-ch-ua': '"Not;A=Brand";v="99", "Android WebView";v="139", "Chromium";v="139"',
      'Content-Type': 'multipart/form-data; boundary=----WebKitFormBoundaryJS7G2eJPBusA2onQ',
      'sec-ch-ua-mobile': '?1',
      'Accept': '*/*',
      'Origin': 'https://snaptik.app',
      'X-Requested-With': 'mark.via.gp',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Referer': 'https://snaptik.app/ar2',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cookie': '__cflb=04dToWzoGizosSfR28YtNMH3Xz1m5yjUYAcxfFNc19; __jscuActive=true'
    }
  }
);
