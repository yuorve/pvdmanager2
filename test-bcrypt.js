const bcrypt = require('bcryptjs');
const hash = '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa';
console.log(bcrypt.compareSync('admin123', hash));
