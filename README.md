# ブロック崩し (Breakout)

ブラウザだけで遊べる HTML5 Canvas 製のブロック崩しゲームです。依存ライブラリ・ビルド不要。

## 遊び方

`index.html` をブラウザで開くだけで起動します。

| 操作 | キー |
| --- | --- |
| パドル移動 | ← → / A D / マウス / タッチ |
| 開始・次レベル・リトライ | Space / Enter / クリック |
| 一時停止 | P / Esc |
| 効果音 ON/OFF | M |

- 3 ライフ制。ボールを落とすとライフが減ります。
- 全ブロックを消すとレベルアップ。ボールが速くなり、パドルが短くなり、上段に 2 回当てないと壊れないブロックが増えます。
- 効果音は Web Audio API で生成（音声ファイル不要）。ミュート設定は `localStorage` に保存されます。
- ハイスコアは `localStorage` に保存されます。

## ローカルで開く

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## GitHub Pages

リポジトリの Settings → Pages で `main` ブランチ / root を公開すると、そのまま遊べます。
