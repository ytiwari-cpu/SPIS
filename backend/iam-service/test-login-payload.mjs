import crypto from 'crypto';

const national_id = '00000000000000';

const hash = crypto
  .createHash('sha256')
  .update(national_id)
  .digest('hex');

console.log('National ID:', national_id);
console.log('Hash:', hash);

const body = {
  national_id: national_id,
  password: 'Argus@1213141'
};

console.log('\nLogin request body:', JSON.stringify(body, null, 2));
