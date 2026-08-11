const bcrypt = require('bcryptjs');
const hash = '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa';
['admin', 'admin123', 'password', '123456', 'pvdmanager'].forEach(p => {
  if (bcrypt.compareSync(p, hash)) console.log("Password is: " + p);
});
