const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../model/userModel');
const jwt = require("jsonwebtoken");

passport.serializeUser((userObj, done) => {
  done(null, userObj);
});

passport.deserializeUser((userObj, done) => {
  done(null, userObj);
});

const validateEnv = () => {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'BACKEND_URL', 'JWT_SECRET'];
  required.forEach(env => {
    if (!process.env[env]) throw new Error(`${env} environment variable is required`);
  });
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/auth/google/callback`,
      scope: ['profile', 'email'],
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        validateEnv();
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
          return done(null, { user, token });
        }

        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          user.googleId = profile.id;
          if (!user.profilePicture && profile.photos?.length > 0) {
            user.profilePicture = profile.photos[0].value;
          }
          await user.save();
          const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
          return done(null, { user, token });
        }

        const newUser = new User({
          name: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          profilePicture: profile.photos?.length > 0 ? profile.photos[0].value : null,
          isVerified: true
        });

        await newUser.save();
        const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        done(null, { user: newUser, token });
      } catch (error) {
        console.error('Google Strategy error:', error);
        done(error);
      }
    }
  )
);

module.exports = passport;