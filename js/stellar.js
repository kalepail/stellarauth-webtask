import { decode } from 'base64-arraybuffer';
import ab2str from 'arraybuffer-to-string';
import _ from 'lodash';
import StellarSdk from 'stellar-sdk';

export function getStellarServer(path) {
  let server;

  path = _.last(path.split('?')[0].split('/'));

  console.log(path);

  if (path === 'public') {
    StellarSdk.Network.usePublicNetwork();
    server = new StellarSdk.Server('https://horizon.stellar.org');
  } else {
    StellarSdk.Network.useTestNetwork();
    server = new StellarSdk.Server('https://horizon-testnet.stellar.org');
  }

  return {StellarSdk, server}
}

export function refillFeeAccount({
  StellarSdk,
  server,
  secrets,
  childAccount
}) {
  let feeKey;

  const masterFundAccount = StellarSdk.Keypair.fromSecret(secrets.MASTER_FUND_SECRET);
  const masterSignerAccounts = _.map(secrets.MASTER_SIGNER_SECRETS.split(','), (secret) => StellarSdk.Keypair.fromSecret(secret));

  server.loadAccount(childAccount.publicKey())
  .then((sourceAccount) => {
    feeKey = ab2str(decode(sourceAccount.data_attr.feeKey));
    return server.loadAccount(feeKey);
  })
  .then((sourceAccount) => {
    const native = _.find(sourceAccount.balances, {asset_type: 'native'});

    if (native.balance < 2.1) // If it's below threshold refill with 0.1 XLM
      return server.loadAccount(masterFundAccount.publicKey())

    else
      throw `Fee account's native balance is ${native.balance}, no need to refill`
  })
  .then((sourceAccount) => {
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount)
    .addOperation(StellarSdk.Operation.payment({
      destination: feeKey,
      asset: StellarSdk.Asset.native(),
      amount: '0.1'
    }))
    .build();

    transaction.sign(
      masterFundAccount,
      ..._.sampleSize(masterSignerAccounts, 2)
    );
    return server.submitTransaction(transaction);
  })
  .then((result) => console.log(result))
  .catch((err) => console.error(err));
}

