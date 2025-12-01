declare module 'react-native-google-recaptcha-v3' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';
  export interface ReCaptchaV3Props extends ViewProps {
    siteKey: string;
    baseUrl: string;
    action?: string;
    onVerify?: (token: string) => void;
    onExpire?: () => void;
    onError?: () => void;
  }
  export default class ReCaptchaV3 extends Component<ReCaptchaV3Props> {
    execute: (action?: string) => Promise<string>;
  }
}
