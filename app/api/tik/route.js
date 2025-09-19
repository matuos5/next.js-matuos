import axios from 'axios';

const response = await axios.post(
  'https://ttsave.app/download',
  {
    'query': 'https://vm.tiktok.com/ZMAAHEDbB/',
    'language_id': '1'
  },
  {
    headers: {
      'Host': 'ttsave.app',
      'Connection': 'keep-alive',
      'Content-Length': '62',
      'sec-ch-ua-platform': '"Android"',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; MAR-LX1A Build/HUAWEIMAR-L21MEB) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36',
      'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Android WebView";v="140"',
      'sec-ch-ua-mobile': '?1',
      'Origin': 'https://ttsave.app',
      'X-Requested-With': 'mark.via.gp',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Referer': 'https://ttsave.app/en',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'ar-SY,ar;q=0.9,en-SY;q=0.8,en-US;q=0.7,en;q=0.6'
    }
  }
);
