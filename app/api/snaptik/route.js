import axios from 'axios';

const response = await axios.post(
  'https://ttsave.app/download',
  {
    'query': 'https://vt.tiktok.com/ZSDB8qqvY/',
    'language_id': '1'
  },
  {
    headers: {
      'Host': 'ttsave.app',
      'Connection': 'keep-alive',
      'Content-Length': '62',
      'sec-ch-ua-platform': '"Android"',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12; M2007J20CG Build/SKQ1.211019.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.7258.160 Mobile Safari/537.36',
      'sec-ch-ua': '"Not;A=Brand";v="99", "Android WebView";v="139", "Chromium";v="139"',
      'sec-ch-ua-mobile': '?1',
      'Origin': 'https://ttsave.app',
      'X-Requested-With': 'mark.via.gp',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Referer': 'https://ttsave.app/en',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  }
);
