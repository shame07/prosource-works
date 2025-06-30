const bcrypt = require('bcrypt');
const password = 'admin123'; // You can change this to your preferred password

bcrypt.hash(password, 10, (err, hash) => {
  if (err) throw err;
  console.log("Hashed password:", hash);
});
