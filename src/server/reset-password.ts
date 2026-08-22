import { config } from "./config";
import { userStore } from "./users";

const username = process.argv[2];
if (!username) {
  console.error("用法：npm run admin:recovery-code -- <管理员用户名>");
  process.exit(1);
}
if (!config.DATABASE_URL) {
  console.error("恢复码命令需要配置 DATABASE_URL，避免只在临时内存中生成无效恢复码");
  process.exit(1);
}

try {
  const result = await userStore.generateRecoveryCode(username);
  console.log(`管理员：${username}`);
  console.log(`恢复码（仅显示这一次，15 分钟内有效）：${result.code}`);
  console.log(`过期时间：${result.expiresAt}`);
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : "生成恢复码失败");
  process.exit(1);
}
