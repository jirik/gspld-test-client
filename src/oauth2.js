import rp from 'request-promise-native';

const user_profile = (iss, access_token, done) => {
  const options = {
    uri: process.env.LAYMAN_USER_PROFILE_URL,
    headers: {
      'AuthorizationIssUrl': iss,
      'Authorization': `Bearer ${access_token}`,
    },
    json: true // Automatically parses the JSON string in the response
  };

  rp(options)
      .then((profile) => {
        // console.log('userProfile callback', profile);
        done(null, profile);
      });
};

const ensure_username = async (iss, access_token, profile) => {
  if (!profile['username']) {
    var options = {
      method: 'PATCH',
      uri: `${process.env.LAYMAN_USER_PROFILE_URL}?adjust_username=true`,
      headers: {
        'AuthorizationIssUrl': iss,
        'Authorization': `Bearer ${access_token}`,
      },
    };
    profile = await rp(options);
  }
  return profile;
};

const get_authn_headers = (user) => {
  return {
    AuthorizationIssUrl: user.authn.iss,
    Authorization: `Bearer ${user.authn.access_token}`,
  }
};

const user_profile_to_client_page_props = (profile) => {
  return {
    username: profile.username,
    display_name: profile.claims.email,
  }
};


const refresh_authn_info = async (oauth2_token_url, client_id, client_secret, user) => {
  // console.log('refresh_authn_info');
  if (user.authn.refreshing) {
    // console.log('ALREADY REFRESHING');
    let i = 0;
    const timer = setTimeout(() => {
      if (!user.authn.refreshing || i > 100) {
        clearTimeout(timer);
      }
    }, 100);
    if (i > 100) {
      throw Error('OAuth2 refresh timeout reached!');
    }
    return;
  }
  const d = new Date();
  const seconds = Math.round(d.getTime() / 1000);
  user.authn.refreshing = true;
  // https://issues.liferay.com/browse/OAUTH2-167
  const new_info = await rp({
    uri: oauth2_token_url,
    method: 'POST',
    form: {
      grant_type: 'refresh_token',
      client_id,
      client_secret,
      refresh_token: user.authn.refresh_token,
    },
    json: true
  });
  user.authn.access_token = new_info.access_token;
  user.authn.iat = seconds; // it's not precise, but should be safe enough
  user.authn.exp = seconds + new_info.expires_in; // it's not precise, but should be safe enough
  user.authn.refresh_token = new_info.refresh_token;
  delete user.authn.refreshing;
};

const refresh_authn_info_if_needed = async (oauth2_token_url, client_id, client_secret, req) => {
  // console.log('refresh_authn_info_if_needed');
  if(req.session.passport && req.session.passport.user) {
    const user = req.session.passport.user;
    const exp = user.authn.exp;
    if (typeof exp !== "number" || exp - 10 <= req.incoming_timestamp) {
      await refresh_authn_info(oauth2_token_url, client_id, client_secret, user);
    }
  }
};


export default {
  user_profile,
  ensure_username,
  get_authn_headers,
  user_profile_to_client_page_props,
  refresh_authn_info,
  refresh_authn_info_if_needed,
};