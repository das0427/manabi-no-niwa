#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""scripts/fonts/base-chars.txt を生成する(既定の文字セット)。

含むもの: ひらがな全部 / カタカナ全部 / 半角ASCII印字文字 / 全角数字 / 基本記号 /
          JIS X 0208 第1水準漢字(2965字, EUC-JP の 16-47 区から生成)
Python 標準ライブラリのみ。"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def jis_level1_kanji() -> str:
    out = []
    for row in range(16, 48):          # 区 16..47
        for cell in range(1, 95):      # 点 1..94
            if row == 47 and cell > 51:  # 第1水準は 47 区 51 点まで(計 2965 字)
                break
            b = bytes([0xA0 + row, 0xA0 + cell])
            out.append(b.decode("euc_jp"))
    return "".join(out)


def main() -> None:
    hira = "".join(chr(c) for c in range(0x3041, 0x3097)) + "ゝゞ"           # ぁ..ゖ ゝゞ
    kata = "".join(chr(c) for c in range(0x30A1, 0x30FB)) + "ヽヾ"           # ァ..ヺ ヽヾ
    ascii_ = "".join(chr(c) for c in range(0x20, 0x7F))
    fw_digits = "０１２３４５６７８９"
    symbols = "、。！？「」ー・＋−＝×（）〜…" + "　『』，．：；％＆～♪☆★○◎●△▲□■♡♥←↑→↓÷＜＞／＊＃＠￥＄゛゜〇々ー―‐−"
    kanji = jis_level1_kanji()
    assert len(kanji) == 2965, len(kanji)
    chars = []
    seen = set()
    for ch in hira + kata + ascii_ + fw_digits + symbols + kanji:
        if ch not in seen:
            seen.add(ch)
            chars.append(ch)
    text = "".join(chars)
    out = HERE / "base-chars.txt"
    out.write_text(text + "\n", encoding="utf-8")
    print(f"{len(chars)} chars -> {out}")


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    main()
