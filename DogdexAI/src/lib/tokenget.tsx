import React, { useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

const SITE_KEY = "6Ldwbw4sAAAAAJdJxxTHVThczZPKj5egdZo_O_zx"; // 🔥 DÁN SITE KEY CỦA BẠN

interface Props {
  action: string;
  onToken: (token: string) => void;
}

export default function RecaptchaV3({ action, onToken }: Props) {
  const webViewRef = useRef<WebView>(null);

  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://www.google.com/recaptcha/api.js?render=${SITE_KEY}"></script>
  </head>
  <body>
    <script>
      window.onload = function () {
        if (!window.grecaptcha) {
          window.ReactNativeWebView.postMessage("GRECAPTCHA_LOAD_FAIL");
          return;
        }

        grecaptcha.ready(function () {
          grecaptcha.execute("${SITE_KEY}", { action: "${action}" })
            .then(function (token) {
              window.ReactNativeWebView.postMessage(token);
            })
            .catch(function (err) {
              window.ReactNativeWebView.postMessage("EXECUTE_ERROR");
            });
        });
      };
    </script>
  </body>
</html>
`;

  return (
    <View style={{ width: 0, height: 0 }}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        originWhitelist={["*"]}
        javaScriptEnabled
        onMessage={(event) => {
          const token = event.nativeEvent.data;
          onToken(token); // ✅ TOKEN HỢP LỆ
        }}
      />
    </View>
  );
}
