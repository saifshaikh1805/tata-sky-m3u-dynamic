const fetch = require('cross-fetch');

module.exports = async (req, res) => {
    
    let uData = {
        sid: req.query.sid.split('_')[0],
        sName: req.query.sname,
        token: req.query.tkn,
        ent: req.query.ent.split('_'),
        tsActive: req.query.sid.split('_')[1] === "D" ? false : true
    };
    if(uData.tsActive)
    {
      let m3uString = await generateM3u(uData);
      res.send(m3uString);
    }
    else
      res.status(409).json({error: "Tata Sky Deactivated"});
}

const getAllChans = async () => {
    var requestOptions = {
      method: 'GET'
    };

    let err = null;
    let res = null;

    await fetch("https://ts-api.videoready.tv/content-detail/pub/api/v1/channels?limit=534", requestOptions)
      .then(response => response.text())
      .then(result => res = JSON.parse(result))
      .then(r => r)
      .catch(error => console.log('error', error));

    let obj = { err };
    if (err === null)
      obj.list = res.data.list;
    return obj;
  }

  const getJWT = async (params, sid, sName, token) => {
    var myHeaders = new fetch.Headers();
    myHeaders.append("Authorization", "bearer " + token);
    myHeaders.append("x-subscriber-id", sid);
    myHeaders.append("x-app-id", "ott-app");
    myHeaders.append("x-app-key", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHBJZCI6ImR2ci11aSIsImtleSI6IiJ9.XUQUYRo82fD_6yZ9ZEWcJkc0Os1IKbpzynLzSRtQJ-E");
    myHeaders.append("x-subscriber-name", sName);
    //myHeaders.append("x-api-key", "YVJNVFZWVlZ7S01UZmRZTWNNQ3lHe0RvS0VYS0NHSwA");
    myHeaders.append("x-api-key", "9a8087f911b248c7945b926f254c833b");
    myHeaders.append("x-device-id", "YVJNVFZWVlZ7S01UZmRZTWNNQ3lHe0RvS0VYS0NHSwA");
    myHeaders.append("x-device-platform", "MOBILE");
    myHeaders.append("x-device-type", "ANDROID");
    myHeaders.append("Content-Type", "application/json");

    var raw = JSON.stringify(params);

    var requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: raw
    };

    let err = null;
    let res = null;

    await fetch("https://kong-tatasky.videoready.tv/auth-service/v1/oauth/token-service/token", requestOptions)
      .then(response => response.text())
      .then(result => {
        console.log("jwtResponse", result);
        res = JSON.parse(result);
      })
      .catch(error => err = error);

    let obj = { err };
    if (err === null)
      obj.token = res.data.token;
    return obj;
  }

  const getUserChanDetails = async (userChannels) => {
    var requestOptions = {
      method: 'GET'
    };

    let err = null;
    let res = null;

    await Promise.all(
      userChannels.map(x =>
        fetch("https://kong-tatasky.videoready.tv/content-detail/pub/api/v1/channels/" + x.id, requestOptions)
          .then(r => r.json())
          .catch(error => err = error)
      )
    ).then(response => Promise.resolve(response))
      .then(result => res = result.filter(c => c.data.meta.length > 0).map(cd => cd.data))
      .catch(error => err = error);

    let obj = { err };
    if (err === null)
      obj.list = res;
    return obj;
  }

  const generateM3u = async (ud) => {
    let errs = [];
    // let userEnt = theUser.entitlements.map(x => x.pkgId);
    let ent = ud.ent;
    let jwt = null;
    let userChans = [];
    let allChans = await getAllChans();
    if (allChans.err === null) {
      userChans = allChans.list.filter(x => x.entitlements.some(y => ent.includes(y)));
      //console.log(userChans);
    }
    else
      errs.push(allChans.err);
    if (errs.length === 0) {
      let paramsForJwt = { action: "stream" };
      paramsForJwt.epids = ent.map(x => { return { epid: "Subscription", bid: x } });
      jwt = await getJWT(paramsForJwt, ud.sid, ud.sname, ud.token);
      if (jwt.err === null) {
        //console.log(jwt);
      }
      else
        errs.push(jwt.err);
    }
    if (errs.length === 0) {
      let userChanDetails = await getUserChanDetails(userChans);
      let chansList = userChanDetails.list;
      //console.log(chansList);
      let m3uStr = '#EXTM3U    x-tvg-url="http://botallen.live/epg.xml.gz"\n\n';
      for (let i = 0; i < chansList.length; i++) {
        m3uStr += '#EXTINF:-1  tvg-id=' + chansList[i].meta[0].channelId.toString() + '  ';
        m3uStr += 'tvg-logo=' + chansList[i].meta[0].channelLogo + '   ';
        m3uStr += 'group-title=' + chansList[i].meta[0].primaryGenre + ',   ' + chansList[i].meta[0].channelName + '\n';
        m3uStr += '#KODIPROP:inputstream.adaptive.license_type=com.widevine.alpha' + '\n';
        m3uStr += '#KODIPROP:inputstream.adaptive.license_key=' + chansList[i].detail.dashWidewineLicenseUrl + '&ls_session=';
        m3uStr += jwt.token + '\n';
        m3uStr += chansList[i].detail.dashWidewinePlayUrl + '\n\n';
      }
      console.log('all done!');
      return m3uStr;
    }
  }
