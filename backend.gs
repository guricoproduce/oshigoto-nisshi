/**
 * LINEミニアプリ お仕事報告システム v2.2
 * Google Apps Script バックエンド
 *
 * こども向けアンケート + 保護者向けアンケート対応版
 * フロントエンドはGitHub Pagesで配信、GASはAPI専用
 */

// Messaging APIのアクセストークン
const LINE_ACCESS_TOKEN = 'WAluExsU5RG8iGOXxnUel2R6Qr23srFZWn1nr8u/eS9KIbl/d6Oh/YGxf7+9DLgrlR6DR82ocXb9NNFf4hu+yn3mfok5PkIFJfXHk63Ol8hNHDUoVPgQUnybUzgJWE8u9jO5kwVhNXfuD3nnwKeOjAdB04t89/1O/w1cDnyilFU=';

// スプレッドシートID
const SPREADSHEET_ID = '11fvojff_5mFbtpQT0iBWBoEoIB99oLBsj9bTzZTJM0s';

// Google SlidesテンプレートID
const SLIDE_TEMPLATE_ID = '1NTobCvey_irZFqCP4lKlCMk-IbAASPtWBPWDDUa9JfI';

// 画像保存用DriveフォルダID
const IMAGE_FOLDER_ID = '1TMeMig8KKVGqvw3YNoO8MqejCARQ7de2';

/**
 * データ送信時の処理 (POSTリクエスト)
 */
function doPost(e) {
  try {
    if (e.postData && e.postData.contents) {
      const data = JSON.parse(e.postData.contents);
      return handlePost(data);
    }

    if (e.parameter) {
      return handlePost(e.parameter);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No data' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handlePost(data) {
  var userId = data.userId;
  var childName = data.childName || "たいけんしゃ";
  var job = data.job;
  var grade = data.grade;

  var childSatisfaction = data.childSatisfaction;
  var wantOtherJobs = data.wantOtherJobs;
  var discovery = data.discovery;
  var region = data.region;

  var parentObservedChange = data.parentObservedChange;
  var parentSatisfaction = data.parentSatisfaction;
  var parentFeedback = data.parentFeedback;
  var desiredContent = data.desiredContent;

  // 1. スプレッドシートに保存
  saveToSheet(userId, childName, job, grade, childSatisfaction, wantOtherJobs, discovery, region,
              parentObservedChange, parentSatisfaction, parentFeedback, desiredContent);

  // 2. LINEメッセージ送信
  if (LINE_ACCESS_TOKEN && LINE_ACCESS_TOKEN !== 'YOUR_CHANNEL_ACCESS_TOKEN') {
    var imageUrl = getCertificateImageUrl(childName, job);

    var messages = [
      {
        type: 'text',
        text: childName + "さん、お仕事体験お疲れ様でした！\n「" + job + "」を立派にやり遂げたね！"
      }
    ];

    // 画像生成に成功した場合のみ画像を追加
    if (imageUrl) {
      messages[0].text += "\n認定証を送るよ！";
      messages.push({
        type: 'image',
        originalContentUrl: imageUrl,
        previewImageUrl: imageUrl
      });
    }

    sendLineMessage(userId, messages);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function saveToSheet(userId, childName, job, grade, childSatisfaction, wantOtherJobs, discovery, region,
                     parentObservedChange, parentSatisfaction, parentFeedback, desiredContent) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheets()[0];
  var timestamp = new Date();

  sheet.appendRow([
    timestamp,
    userId,
    childName,
    job,
    grade,
    childSatisfaction,
    wantOtherJobs,
    discovery,
    region,
    parentObservedChange,
    parentSatisfaction,
    parentFeedback,
    desiredContent
  ]);
}

/**
 * Google Slidesを活用した動的認定証生成
 * スライドをPNGエクスポートし、公開URLを返す
 */
function getCertificateImageUrl(name, job) {
  try {
    // 1. テンプレートSlideをコピー
    var templateFile = DriveApp.getFileById(SLIDE_TEMPLATE_ID);
    var folder = DriveApp.getFolderById(IMAGE_FOLDER_ID);
    var newFileName = '認定証_' + job + '_' + new Date().getTime();
    var newFile = templateFile.makeCopy(newFileName, folder);
    var presentationId = newFile.getId();

    // 2. Slide内のテキストを置換
    var presentation = SlidesApp.openById(presentationId);
    var slides = presentation.getSlides();
    var firstSlide = slides[0];
    firstSlide.replaceAllText('{{name}}', name);
    firstSlide.replaceAllText('{{job}}', job);
    presentation.saveAndClose();

    // 3. PNG画像としてエクスポート
    var exportUrl = 'https://docs.google.com/presentation/d/' + presentationId + '/export/png';
    var response = UrlFetchApp.fetch(exportUrl, {
      headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() }
    });
    var imageBlob = response.getBlob().setName(newFileName + '.png');

    // 4. 画像をDriveに保存
    var imageFile = folder.createFile(imageBlob);

    // 5. 誰でもアクセスできるように公開設定
    imageFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 6. LINE APIがアクセスできる直リンクURLを生成
    var imageId = imageFile.getId();
    var publicUrl = 'https://lh3.googleusercontent.com/d/' + imageId;

    // コピーしたスライドは不要なので削除
    newFile.setTrashed(true);

    return publicUrl;

  } catch (e) {
    Logger.log("画像生成エラー: " + e.toString());
    return null;
  }
}

function sendLineMessage(userId, messages) {
  var url = 'https://api.line.me/v2/bot/message/push';
  var payload = {
    to: userId,
    messages: messages
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload)
  });
}

/**
 * テスト用関数 - GASエディタから手動実行して動作確認
 */
function testSendMessage() {
  try {
    var url = 'https://api.line.me/v2/bot/message/push';
    var payload = {
      to: "U70bfe2ed4f5ffbf601f748631be662ca",
      messages: [{ type: 'text', text: 'テスト送信です' }]
    };
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    Logger.log("レスポンス: " + res.getResponseCode() + " " + res.getContentText());
  } catch(e) {
    Logger.log("エラー: " + e.toString());
  }
}

