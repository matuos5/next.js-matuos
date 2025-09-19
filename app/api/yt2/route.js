import axios from 'axios';

const response = await axios.post(
  'https://ar.savefrom.net/savefrom.php',
  new URLSearchParams({
    'sf_url': 'https://youtube.com/shorts/jfRceToZkLQ?si=I2FLPJaQrvR_gXP4',
    'sf_submit': '',
    'new': '2',
    'lang': 'ar',
    'app': '',
    'country': 'sy',
    'os': 'Android',
    'browser': 'Chrome',
    'channel': 'main'
  }),
  {
    headers: {
      'Host': 'ar.savefrom.net',
      'Connection': 'keep-alive',
      'Content-Length': '159',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Android WebView";v="140"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
      'Origin': 'https://ar.savefrom.net',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; MAR-LX1A Build/HUAWEIMAR-L21MEB) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7339.51 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'X-Requested-With': 'mark.via.gp',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'iframe',
      'Referer': 'https://ar.savefrom.net/249Ex/',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'ar-SY,ar;q=0.9,en-SY;q=0.8,en-US;q=0.7,en;q=0.6',
      'Cookie': 'lang=ar; country=SY; x-requested-with=mark.via.gp; uid=08bd42a6f97ecc32; sfHelperDist=14; apkHelperDist=19; reference=73; clickAds=83; clickAdsOnError=60; poropellerAdsPush-e=62; promoBlock=48; partnersBlock=69; downloadButtonOnThumbnail=98; popupAfterDownload=6; proSubscribed=49; tzTopQualityV2=95; _ga=GA1.2.455722374.1758280614; _gid=GA1.2.1819920525.1758280614'
    }
  }
);
