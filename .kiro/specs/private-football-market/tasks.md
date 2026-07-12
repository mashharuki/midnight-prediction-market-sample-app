# Implementation Tasks

## 1. Contract foundation

- [x] 1.1 予測市場の失敗するSimulatorテストとprivate witness型を作る
  - commit/reveal/phase/権限/配当の期待動作がテストで観測できる。
  - _Boundary: Contract Tests_
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 6.2_

- [x] 1.2 Compact市場コントラクトを実装し生成する
  - 全Simulatorテストが通り、managed/prediction-marketがソースから生成される。
  - _Depends: 1.1_
  - _Boundary: Compact Contract_
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 6.1, 6.2_

## 2. SDK integration

- [x] 2.1 shared型とContract exportを市場向けに移行する
  - contract/sharedが型安全にbuildできる。
  - _Depends: 1.2_
  - _Boundary: Shared Types_
  - _Requirements: 4.2, 4.3, 6.1_

- [ ] 2.2 browser SDK adapterとhookのテストを先に作り実装する
  - deploy/join/commit/reveal/admin/resolve/claimとnetwork分離がhookから操作できる。
  - _Depends: 2.1_
  - _Boundary: Browser SDK_
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 2.3 CLIを市場操作へ移行する
  - Standalone/Preview/Preprod設定を持つ市場CLIがbuildし、資格情報と資金がある環境向けsmoke手順が文書化される。
  - _Depends: 2.1_
  - _Boundary: CLI_
  - _Requirements: 4.2, 4.4, 6.1_

## 3. Product UI

- [x] 3.1 デザイントークンと市場画面を実装する
  - 4チーム、予測票、market pulse、wallet/network、phase別CTAがresponsiveに表示される。
  - _Depends: 2.2_
  - _Boundary: React UI_
  - _Requirements: 1.1, 1.2, 2.1, 2.3, 3.1, 3.2, 4.5, 5.1, 5.2, 5.3, 5.4_

- [x] 3.2 管理者画面、状態、エラー、i18nを完成する
  - 一般参加者と管理者の全フローが日英・キーボード操作で完走する。
  - _Depends: 3.1_
  - _Boundary: React UX_
  - _Requirements: 2.2, 2.4, 2.5, 2.6, 3.1, 3.2, 3.4, 4.5, 5.3, 5.4_

## 4. Delivery quality

- [x] 4.1 READMEを予測市場Example App向けに改稿する
  - privacy、設計、全コマンド、信頼モデル、トラブル対応がREADMEだけで理解できる。
  - _Depends: 2.3, 3.2_
  - _Boundary: Documentation_
  - _Requirements: 6.3_

- [ ] 4.2 全体検証とproduction smokeを実行し不整合を修正する
  - 隔離したfresh cloneでbun install、Compact compile、lint、typecheck、test、build、production preview smokeが成功する。外部ネットワークsmokeは資格情報がある場合に別途実行する。
  - _Depends: 4.1_
  - _Boundary: Integration Verification_
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3_

## Implementation Notes

- Compact 0.30では整数除算演算子がないため、claim callerがfloor rewardを渡し、回路が `r*p <= n < (r+1)*p` を証明する。
