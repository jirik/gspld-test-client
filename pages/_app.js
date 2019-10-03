import React from "react";
import App, {Container as NextContainer} from "next/app";
import getConfig from 'next/config'
import fetch from 'isomorphic-unfetch';
const { publicRuntimeConfig } = getConfig();


const anonymous_user = {
  authenticated: false,
  display_name: 'Anonymous',
};

class MyApp extends App {
  static async getInitialProps({Component, ctx}) {
    console.log('_app.js getInitialProps');
    let pageProps = {};
    if (Component.getInitialProps) {
      pageProps = await Component.getInitialProps(ctx);
    }
    if (ctx.req && ctx.req.session.passport && ctx.req.session.passport.user) {
      const user_util = require('./../src/user').default;
      const auth_providers = require('./../auth-providers').default();
      const user = ctx.req.session.passport.user;
      const provider = auth_providers[user.authn.iss_id];
      await provider.refresh_authn_info_if_needed(ctx.req);
      await user_util.check_current_user(auth_providers, ctx.req);

      // we need to check it again, because check_current_user could logout automatically
      if (ctx.req && ctx.req.session.passport && ctx.req.session.passport.user) {
        pageProps.user = {
          authenticated: true,
          username: ctx.req.session.passport.user.username,
          display_name: ctx.req.session.passport.user.display_name,
        };
      }
    }
    console.log(`_app.js getInitialProps pageProps=${JSON.stringify(pageProps)}`);
    return {pageProps};
  }

  constructor(props) {
    console.log(`_app.js constructor pageProps=${JSON.stringify(props.pageProps)}`);
    super(props);
    const user = props.pageProps.user || JSON.parse(JSON.stringify(anonymous_user));
    this.state = {
      user,
    };

  }
  componentDidMount() {
    setInterval(this.refresh_user.bind(this), publicRuntimeConfig.REFRESH_USER_INTERVAL*1000);
  }

  async refresh_user() {
    const res = await fetch('/current-user-props');
    const json = await res.json();
    // console.log('refresh_user', json);
    const user = json.authenticated ? json : JSON.parse(JSON.stringify(anonymous_user));
    if(!json.authenticated && (json.authn_error || this.state.user.latest_authn_error)) {
      user.latest_authn_error = json.authn_error || this.state.user.latest_authn_error;
    }
    console.log('setting state', user);
    this.setState({
      user,
    });
  };

  render() {
    // console.log(`_app.js render state=${JSON.stringify(this.state)}`);
    // console.log(`_app.js render this.props.pageProps=${JSON.stringify(this.props.pageProps)}`);
    const {Component, pageProps} = this.props;

    const props = {
      ...pageProps,
      user: this.state.user,
      handle_authn_failed: this.refresh_user.bind(this),
    };

    return (
        <NextContainer>
          <Component {...props} />
        </NextContainer>
    );
  }
}

export default MyApp;