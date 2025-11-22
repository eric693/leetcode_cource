# 🎯 LeetCode 學習平台

完整的 LeetCode 題目學習網站,包含 Easy、Medium、Hard 三種難度,提供 Python 和 C++ 詳解,支援完整的語法高亮。

## ✨ 特色功能

- 📚 **多難度題目**: Easy / Medium / Hard 完整分類
- 💻 **雙語言支援**: Python 和 C++ 完整程式碼實現
- 🎨 **語法高亮**: 使用 highlight.js,關鍵字、字串、函數、註解都有顏色區分
- 📱 **響應式設計**: 支援桌面和行動裝置
- 🔍 **題目篩選**: 可按難度快速篩選題目
- 📖 **詳細解說**: 每題包含題目描述、解題思路、複雜度分析

## 📂 專案結構

```
leetcode-learning/
├── index.html              # 主頁面 - 題目列表
├── problems/              # 題目詳解資料夾
│   ├── two-sum.html                    # Easy: Two Sum
│   ├── reverse-string.html             # Easy: Reverse String
│   ├── merge-sorted-array.html         # Easy: Merge Sorted Array
│   ├── longest-substring.html          # Medium: Longest Substring
│   ├── add-two-numbers.html            # Medium: Add Two Numbers
│   ├── container-with-most-water.html  # Medium: Container With Most Water
│   ├── median-of-two-sorted-arrays.html # Hard: Median of Two Sorted Arrays
│   ├── trapping-rain-water.html        # Hard: Trapping Rain Water
│   └── merge-k-sorted-lists.html       # Hard: Merge k Sorted Lists
└── README.md              # 專案說明文件
```

## 🚀 部署到 GitHub Pages

### 方法一: 使用 GitHub 網頁介面

1. 在 GitHub 建立新的 repository
2. 上傳所有檔案(保持資料夾結構)
3. 進入 Settings → Pages
4. Source 選擇 `main` branch
5. 儲存後等待部署完成

### 方法二: 使用 Git 指令

```bash
# 初始化 Git 倉庫
git init

# 添加所有檔案
git add .

# 提交
git commit -m "Initial commit: LeetCode learning platform"

# 連接遠端倉庫(替換成你的 GitHub 倉庫 URL)
git remote add origin https://github.com/yourusername/leetcode-learning.git

# 推送到 GitHub
git push -u origin main
```

### 方法三: 直接下載並上傳

1. 下載整個專案資料夾
2. 在 GitHub 建立新 repository
3. 將檔案拖曳上傳到 GitHub
4. 在 Settings → Pages 啟用 GitHub Pages

## 📋 已收錄題目

### Easy (3 題)
- ✅ 1. Two Sum - 雜湊表經典題
- ✅ 344. Reverse String - 雙指標基礎
- ✅ 88. Merge Sorted Array - 陣列合併

### Medium (3 題)
- ✅ 3. Longest Substring Without Repeating Characters - 滑動視窗
- ✅ 2. Add Two Numbers - 鏈表操作
- ✅ 11. Container With Most Water - 雙指標進階

### Hard (3 題)
- ✅ 4. Median of Two Sorted Arrays - 二分搜尋經典
- ✅ 42. Trapping Rain Water - 動態規劃/雙指標
- ✅ 23. Merge k Sorted Lists - 分治法/堆積

## 🎨 技術特點

### 語法高亮
使用 [highlight.js](https://highlightjs.org/) 提供完整的程式碼高亮:
- **關鍵字**: `class`, `def`, `for`, `if` 等以特殊顏色標示
- **字串**: 字串常數有獨特顏色
- **函數**: 函數名稱高亮顯示
- **註解**: 註解以灰色系顯示

### 響應式設計
- 自適應桌面、平板、手機螢幕
- 卡片式佈局,閱讀體驗佳
- 漸層色背景,視覺效果出色

## 💡 使用方式

1. 開啟 `index.html` 查看所有題目
2. 點擊任一題目卡片進入詳解頁面
3. 使用頂部按鈕在 Python 和 C++ 之間切換
4. 點擊「返回題目列表」回到主頁

## 📝 自訂擴充

想要新增更多題目?

1. 複製任一現有的題目 HTML 檔案
2. 修改內容:
   - 題目編號和標題
   - 難度(Easy/Medium/Hard)
   - 題目描述和範例
   - Python 和 C++ 程式碼
   - 解題思路說明
3. 在 `index.html` 新增對應的題目卡片
4. 調整顏色主題(Easy: 綠色, Medium: 黃色, Hard: 紅色)

## 🌐 線上預覽

部署後的網址格式:
```
https://yourusername.github.io/repository-name/
```

## 📄 授權

此專案為教育用途,歡迎自由使用和修改。

## 🤝 貢獻

歡迎提交 Pull Request 新增更多題目或改善現有內容!

---

**Made with ❤️ for LeetCode learners**
