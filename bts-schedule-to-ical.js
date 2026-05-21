import { Notion2ICal } from "notion2ical";
import { Client } from "@notionhq/client";
import { writeFileSync } from "node:fs";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) {
  console.error("❌ NOTION_TOKENが設定されていません");
  console.error("   実行方法: NOTION_TOKEN=secret_xxx node bts-schedule-to-ical.js");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const converter = new Notion2ICal({ notionClient: notion });

console.log("⏳ Notionからスケジュールを取得中...");

const icsString = await converter.convert(
  "459d40a440904601a232496c0a896b63", // BTS SCHEDULE データベースID
  "NAME",   // タイトルプロパティ
  "DATE",   // 日付プロパティ
  undefined,
  "BTS SCHEDULE",
  60 * 60 * 1000, // デフォルト1時間
);

const outputPath = "bts-schedule.ics";
writeFileSync(outputPath, icsString);
console.log(`✅ 生成完了: ${outputPath}`);
console.log("📅 Googleカレンダーにインポートする手順:");
console.log("   1. Google カレンダーを開く");
console.log("   2. 設定 > 他のカレンダーをインポート");
console.log("   3. bts-schedule.ics を選択");
