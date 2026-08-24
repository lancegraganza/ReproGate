# Networks

Never store secret keys or seed phrases here.

## Local

- Network: local Quickstart
- Command: `stellar container start local`
- Current environment: blocked because Docker is not installed
- Contract tests and optimized Wasm builds passed independently of Docker

## Testnet

- Deployer: `GCMSETCD3MHRB3WGMBFM7PUG4DBLLV4JG4LUVBK6X7LIZYUQEECN6OCF`
- Native XLM SAC: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- Registry: [`CAH5OSI255VRSJJQVM6JCR77E5C52IB7Y6WCNZYVC3DH7MDSVMRLHMVI`](https://lab.stellar.org/r/testnet/contract/CAH5OSI255VRSJJQVM6JCR77E5C52IB7Y6WCNZYVC3DH7MDSVMRLHMVI)
- Vault: [`CDDE25PTGG2XOTQHJ25CIQRUBJ6I6Q4WLIIWSURLLWP26B5HKABWNU5E`](https://lab.stellar.org/r/testnet/contract/CDDE25PTGG2XOTQHJ25CIQRUBJ6I6Q4WLIIWSURLLWP26B5HKABWNU5E)
- Registry Wasm: `44e97576fe458978bceaaef1ee7893646287260ee69e7dbcfdb7bbd2ca9067da`
- Vault Wasm: `57dc15144870ae712a44466782cab0eeed308ffe99fed54dc273ea240b76e88d`

Deployment: [registry](https://stellar.expert/explorer/testnet/tx/72e3a787081adc7e24776e7e8ed1f7339863196cfb524db37f2ce80ff71119ef), [vault](https://stellar.expert/explorer/testnet/tx/aaf19d33408ec6c08f07f87cae8784b2e0ea8111add7e5e08cdac2b186f80dcf), [registry configuration](https://stellar.expert/explorer/testnet/tx/10b07f3d2f71bcc2b435f128aa56ab20d0ba7b4d1b907a988625525232545edb), [vault configuration](https://stellar.expert/explorer/testnet/tx/4d9879eb50aaa06d171d071d8da37380271fce883f77855ecedeb7329f9f6fcb).

### End-to-end application evidence

- Task: `ae3e672d-ed7b-4f23-9ab1-98851e83cac7`
- Task hash: `d3fecbc1a1d6ae3b4364f7483fa7022eda63c590a25e433556d7d023fe78858a`
- [2 XLM funding](https://stellar.expert/explorer/testnet/tx/9fdb126a67e18e5e1f381d687a6a00570eb6fbd1ca32782f317b221859d687d9)
- [Registry creation](https://stellar.expert/explorer/testnet/tx/06b624053e8c2311028e3b6c69cc11a3f781414abbb8de3687c7ddb6440cb895)
- [Finalization and two 1 XLM payouts](https://stellar.expert/explorer/testnet/tx/52223943fc94b5648d802c6d9b52dc194fec801d57d51e8ab8082e3ae21f81c1)
- Result: `9d2d70dbb46060ff733199b5a1455fcef7a8dd5eb582db1f184c7c336fb0053c`
- Observed state: `DRAFT → FUNDING → OPEN → VERIFYING → VERIFIED`
- Repeated event poll: 20 events indexed on first poll, zero duplicate inserts on the next poll
- [Classic 0.1 XLM transfer](https://stellar.expert/explorer/testnet/tx/737c0709f0713275f29f3cde14919cf9967a3108b11199235ffe92b543419072)

An additional CLI smoke on the same reviewed deployment exercised the activation handshake: [fund](https://stellar.expert/explorer/testnet/tx/ee8d4c43b6c94cd2a22da0d0479a1f7e49ea2d7dc376147ce294f9049f51a755), [register](https://stellar.expert/explorer/testnet/tx/a2745055a0c47356884c70243307a6c35ba550a69cac3a86d189b78ee72056cb), and [two 0.5 XLM payouts](https://stellar.expert/explorer/testnet/tx/b1b8143d56fb19be71fadfbce5a706ae96861417aecffe683388d0ab35c48dde).

## Mainnet

**Disabled.** Configuration rejects Mainnet and no Mainnet transaction was submitted.
