# curiosity trail

何にハマって、どんな行動をしたかを記録する個人サイト。
GitHub の草のようなヒートマップで日々の動きを見て、今週・今月・今年の振り返りができる。

## 記録のしかた

### 1. ハマったものを追加する

`src/content/interests/<id>.md` を 1 つ作る。ファイル名（拡張子なし）が id になり、URL にも使われる（英数字とハイフン推奨）。

```md
---
name: サワードウ          # 表示名
category: 料理            # カテゴリ。草の「カテゴリ数」はこれで数える
started: 2026-01-11       # ハマり始めた日
status: active            # active（ハマり中） / paused（休憩中） / done（卒業）
summary: 自家製の酵母でパンを焼く。   # 任意。一行の説明
---

ここから下は自由に書けるメモ。個別ページに表示される。
```

### 2. 行動を記録する

`src/data/logs.yaml` の末尾に追記する。

```yaml
- date: 2026-10-17
  interest: sourdough      # 上で作ったファイルの id
  action: カンパーニュを焼いた
  kind: 作った             # 任意。読んだ / 行った / 買った / 作った など
  note: 加水率を 75% にした  # 任意
  url: https://example.com # 任意。action がリンクになる
```

存在しない `interest` を書くとビルドが失敗するので、打ち間違いに気づける。

> いま入っているのはサンプルデータ。`src/content/interests/` と `src/data/logs.yaml` の中身を自分の記録に置き換えて使う。

## 草の色

- **アクション数**: その日に記録した行動の数（1 / 2–3 / 4–5 / 6 以上）
- **カテゴリ数**: その日に触れたカテゴリの数（1 / 2 / 3 / 4 以上）

右上で「直近1年」と年ごとの表示を切り替えられる。マスを押すとその日の記録が出る。
「今週・今月・今年」の集計は見ている人のブラウザで計算するので、再ビルドしなくても日付に合わせて更新される（週は月曜始まり）。

## コマンド

| コマンド | 内容 |
| :-- | :-- |
| `npm install` | 依存関係のインストール |
| `npm run dev` | `localhost:4321` で確認 |
| `npm run build` | `./dist/` にビルド |
| `npm test` | 日付・集計ロジックのテスト |

## GitHub Pages で公開する

1. GitHub にリポジトリを作って push する
2. リポジトリの Settings → Pages → Build and deployment の Source を **GitHub Actions** にする
3. `main` に push するたびに `.github/workflows/deploy.yml` がビルドして公開する

URL（`https://<ユーザー名>.github.io/<リポジトリ名>/`）は Actions が自動で設定するので、`astro.config.mjs` を書き換える必要はない。

## 構成

```text
src/
├── content/interests/*.md   ハマったもの（1 ファイル 1 つ）
├── data/logs.yaml           行動の記録
├── content.config.ts        データの形（スキーマ）
├── lib/trail.ts             日付・集計の計算（テストあり）
├── scripts/trail-client.ts  草と振り返りの描画
├── components/Trail.astro   草のコンポーネント
└── pages/                   トップ / 一覧 / 個別ページ
```
