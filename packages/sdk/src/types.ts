export interface Player {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  isHost: boolean;
}

export interface GameAction {
  type: string;
  payload?: Record<string, unknown>;
}

export interface GameResult {
  rankings: {
    playerId: string;
    rank: number;
    score: number;
    isWinner: boolean;
  }[];
  data?: Record<string, unknown>;
}

export type HapticImpactStyle = 'light' | 'medium' | 'heavy';
export type HapticNotificationType = 'success' | 'warning' | 'error';

export interface DeviceTilt {
  /** 绕 z 轴旋转 (0~360) —— 指南针方向 */
  alpha: number;
  /** 绕 x 轴旋转 (-180~180) —— 前后倾斜 */
  beta: number;
  /** 绕 y 轴旋转 (-90~90) —— 左右倾斜 */
  gamma: number;
}

export interface DeviceCapabilities {
  haptics: boolean;
  motion: boolean;
}

export interface Platform {
  getPlayers(): Player[];
  getLocalPlayer(): Player;
  send(action: GameAction): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  reportResult(result: GameResult): void;
  /**
   * 获取游戏资产的运行时 URL。
   * @param path - 相对于游戏 assets/ 目录的路径，如 "cards/king.png"、"sounds/flip.mp3"
   * @returns 可直接用于 <img src> / <audio src> / fetch() 的完整 URL
   */
  getAssetUrl(path: string): string;

  /**
   * 查询当前运行环境的设备能力。
   * 游戏可据此决定是否启用某些交互，或提供视觉降级方案。
   */
  getDeviceCapabilities(): DeviceCapabilities;

  /**
   * 触发震动反馈。不支持时静默忽略。
   */
  haptic(
    type: 'impact' | 'notification' | 'selection',
    option?: HapticImpactStyle | HapticNotificationType,
  ): void;

  /**
   * 监听摇晃事件。平台负责处理权限请求和加速度阈值判定。
   * @returns 取消监听的函数
   */
  onShake(handler: () => void): () => void;

  /**
   * 监听设备倾斜数据流。平台负责处理权限请求。
   * @param handler 约 60fps 回调
   * @returns 取消监听的函数
   */
  onTilt(handler: (tilt: DeviceTilt) => void): () => void;
}
