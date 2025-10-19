/**
 * 地址验证和规范化工具
 * 独立于 ethers，避免 Next.js 兼容性问题
 */

/**
 * 验证是否为有效的以太坊地址
 * @param address 地址字符串
 * @returns 是否有效
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * 规范化地址为小写格式
 * @param address 地址字符串
 * @returns 规范化后的地址
 */
export function normalizeAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new Error('Invalid address format')
  }
  return address.toLowerCase()
}

/**
 * 验证交易哈希格式
 * @param hash 交易哈希
 * @returns 是否有效
 */
export function isValidTransactionHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash)
}
