# LeetCode 學習平台

完整的 LeetCode 題目學習網站,包含 Easy、Medium、Hard 三種難度,提供 Python、C++ 和 Java 詳解。

## 特色功能

- **分類整理**: 依照主題分類(Array, Stack, Binary Tree, DP等)
- **三語言支援**: Python、C++ 和 Java 完整程式碼實現
- **難度篩選**: 可按難度快速篩選題目
- **詳細解說**: 每題包含題目描述、解題思路、複雜度分析
- **現代化設計**: 簡潔專業的介面,舒適的閱讀體驗
- **響應式佈局**: 支援桌面、平板和手機

## 專案結構

```
leetcode-learning/
├── index.html              # 主頁面 - 題目列表(依分類)
├── problems/              # 題目詳解資料夾
│   ├── two-sum.html
│   ├── valid-parentheses.html
│   ├── longest-substring.html
│   ├── median-of-two-sorted-arrays.html
│   └── ...更多題目
├── README.md              # 本文件
├── DEPLOY_GUIDE.md       # GitHub Pages 部署指南
└── QUICKSTART.md         # 快速開始教學
```

## 題目分類

### Array & Hash Table
- Two Sum (Easy)
- Group Anagrams (Medium)
- Top K Frequent Elements (Medium)

### Two Pointers & Sliding Window
- Valid Palindrome (Easy)
- Longest Substring Without Repeating Characters (Medium)
- Container With Most Water (Medium)

### Stack & Queue
- Valid Parentheses (Easy)
- Min Stack (Medium)
- Daily Temperatures (Medium)

### Binary Search
- Binary Search (Easy)
- Search in Rotated Sorted Array (Medium)
- Median of Two Sorted Arrays (Hard)

### Linked List
- Reverse Linked List (Easy)
- Add Two Numbers (Medium)
- Merge k Sorted Lists (Hard)

### Binary Tree
- Invert Binary Tree (Easy)
- Maximum Depth of Binary Tree (Easy)
- Validate Binary Search Tree (Medium)

### Dynamic Programming
- Climbing Stairs (Easy)
- Coin Change (Medium)
- Longest Increasing Subsequence (Medium)

## 部署到 GitHub Pages

### 快速部署

1. **建立 GitHub Repository**
   - 在 GitHub 建立新的 repository
   - 命名為 `leetcode-learning`

2. **上傳檔案**
   - 將所有檔案上傳到 repository
   - 保持資料夾結構不變

3. **啟用 GitHub Pages**
   - Settings → Pages
   - Source 選擇 `main` branch
   - 儲存並等待部署完成

你的網站將在 `https://你的使用者名稱.github.io/leetcode-learning/` 上線

詳細步驟請參考 [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md)

## 本地使用

直接用瀏覽器開啟 `index.html` 即可開始使用!

## 設計特點

### 配色方案
- **主題色**: 藍色系 `#1e3a8a`
- **Easy**: 綠色 `#10b981`
- **Medium**: 黃色 `#f59e0b`
- **Hard**: 紅色 `#ef4444`
- **背景**: 淡灰藍 `#f8fafc`

### 技術特點
- 使用 highlight.js 提供程式碼高亮
- 響應式設計,自適應各種螢幕
- 卡片式佈局,閱讀體驗佳
- 清晰的視覺層次

## 自訂擴充

想要新增更多題目?

1. 複製任一題目的 HTML 檔案
2. 修改內容(題目、難度、程式碼)
3. 在 `index.html` 的對應分類中新增題目卡片

## 授權

此專案為教育用途,歡迎自由使用和修改。

## 貢獻

歡迎提交 Pull Request 新增更多題目或改善現有內容!

---

**持續更新中,敬請期待更多題目!**