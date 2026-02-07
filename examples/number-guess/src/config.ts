// examples/number-guess/src/config.ts
import type { GameConfig } from "@littlepartytime/sdk";

const config: GameConfig = {
  name: "猜数字",
  description: "轮流猜一个 1-100 之间的数字，猜中的人出局！范围会逐渐缩小，谁能坚持到最后？",
  assets: {
    icon: "assets/icon.png",
    banner: "assets/banner.png",
    cover: "assets/cover.png",
    splash: "assets/splash.png",
  },
  minPlayers: 2,
  maxPlayers: 8,
  tags: ["休闲", "策略"],
  version: "1.0.0",
  sdkVersion: "2.0.0",
};

export default config;
