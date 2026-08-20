# Local deployment
git clone git@github.com:luanpm88/builder.git builder
cd builder
git checkout develop
npm install
npm run build

# Create symbolic link (adjust path if needed)
ln -s /home/luan/builder/dist demo/dist

# Start PHP web server with docroot set to the ./demo folder inside the project