'use strict'

const normaliseInput = require('ipfs-core-utils/src/pins/normalise-input')
const { resolvePath, withTimeoutOption } = require('../../utils')
const { PinTypes } = require('./pin-manager')

/**
 * @param {Object} config
 * @param {import('./pin-manager')} config.pinManager
 * @param {import('../init').RWLock} config.gcLock
 * @param {import('../index').DAG} config.dag
 */
module.exports = ({ pinManager, gcLock, dag }) => {
  /**
   * Unpin one or more blocks from your repo
   *
   * @param {PinsSource} source - Unpin all pins from the source
   * @param {AbortOptions} [options]
   * @returns {AsyncIterable<CID>}
   * @example
   * ```js
   * const source = [
   *   CID.from('QmWATWQ7fVPP2EFGu71UkfnqhYXDYH566qy47CnJDgvs8u')
   * ]
   * for await (const cid of ipfs.pin.rmAll(source)) {
   *   console.log(cid)
   * }
   * // prints the CIDs that were unpinned
   * // CID('QmWATWQ7fVPP2EFGu71UkfnqhYXDYH566qy47CnJDgvs8u')
   * ```
   */
  // @ts-ignore - 'options' is declared but its value is never read.ts(6133)
  async function * rmAll (source, options = {}) {
    const release = await gcLock.readLock()

    try {
      // verify that each hash can be unpinned
      for await (const { path, recursive } of normaliseInput(source)) {
        const cid = await resolvePath(dag, path)
        const { pinned, reason } = await pinManager.isPinnedWithType(cid, PinTypes.all)

        if (!pinned) {
          throw new Error(`${cid} is not pinned`)
        }

        switch (reason) {
          case (PinTypes.recursive):
            if (!recursive) {
              throw new Error(`${cid} is pinned recursively`)
            }

            await pinManager.unpin(cid)

            yield cid

            break
          case (PinTypes.direct):
            await pinManager.unpin(cid)

            yield cid

            break
          default:
            throw new Error(`${cid} is pinned indirectly under ${reason}`)
        }
      }
    } finally {
      release()
    }
  }

  return withTimeoutOption(rmAll)
}

/**
 * @typedef {import('cids')} CID
 * @typedef {import('../../utils').AbortOptions} AbortOptions
 * @typedef {import('./add-all').PinsSource} PinsSource
 */
