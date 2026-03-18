# LIFF Permission Error Analysis

## Executive Summary
**結論から言おう。原因は明白だ。**
LINE Developers Consoleでの「Scope（権限）」設定が足りていない。
君のコードは `liff.getProfile()` を呼び出しているが、LINE側で「プロフィール情報を取得していいよ」という許可を出していない。だから「Permission is not in LIFF app scope（このLIFFアプリのスコープにその権限はない）」と怒られているわけだ。

## Tech Deep Dive
### 1. エラーの発生源
`index.html` の以下の行がトリガーだ。

```javascript
261:             try {
262:                 const profile = await liff.getProfile(); // <--- ここで落ちている
```

`liff.getProfile()` は、ユーザーの `userId` や `displayName` を取得するメソッドだ。これを使うには、LIFFアプリ側で明示的に `profile` スコープを有効にする必要がある。これはセキュリティ上の仕様であり、回避策はない。

### 2. なぜ `no-cors` や GAS ではなく LIFF なのか
エラーメッセージ `The permission is not in LIFF app scope` は、LIFF SDKが出す固有のエラーだ。
もし GAS への `fetch` が原因なら、Network Error や CORS エラーが出るはずだ。今回のエラーは、GAS にデータを投げる **手前**、プロフィール情報を取得しようとした瞬間に発生している。

## Solution (Action Required)
いますぐ LINE Developers Console を開き、以下の手順を実行せよ。

1.  **LINE Developers Console にログイン**
2.  該当する **LIFFチャネル** を選択
3.  **[LIFF]** タブをクリック
4.  **[Scopes]** (スコープ) の設定を探す
5.  **`profile`** と **`openid`** (もしあれば) にチェックを入れる
6.  **保存** する

これだけで動くはずだ。
データなんてものは、取れるように設定しなければ取れない。当たり前のことだ。

## Future Outlook (Optional Advice)
現在の実装では `fetch` に `mode: 'no-cors'` を使っているな。
```javascript
mode: 'no-cors',
```
これは「送信できたかどうか」をクライアント側で検知できない（不透明なレスポンスになる）設定だ。
今はまず送信エラーを直すことが先決だが、将来的には GAS 側で `Content-Type: text/plain` を受け取り、正しく CORS ヘッダー (`Access-Control-Allow-Origin: *`) を返すように実装し、`cors` モードで通信すべきだ。そうしないと、ユーザーは「送信に失敗したのに成功画面が出る」という最悪のUXを体験することになるかもしれない。

まずは Scope を直せ。話はそれからだ。
