import async from 'async';
import crypto from 'crypto';
import moment from 'moment';
import passport from 'passport';
import logger from '../util/logger';
//import process from "../util/process"; sw - npm warning never used :/
import { Request, Response, NextFunction } from 'express';
import { UserModel, usernameFieldName, passwordFieldName, passwordResetToken, passwordResetExpires } from '../models/user';
import { findUserByField, createUser, updateUser, insertSession, updateSession, updateUserNewSignup, getUserExperiments, insertNewUserExperiment } from '../database/user';
import { usernameExists, usernameNotTaken, isNotEmail, isValidUsername, checkPasswordLength, confirmMatchPassword } from '../validation/validators';
import { encryptPassword } from '../util/encrypt';
import { makeRenderObject } from '../config/handlebars-helpers';
import '../config/passport';
import { throws } from 'assert';

/**
 * GET /login
 * Login page
 */
export const getLogin = (req: Request, res: Response) => {
  if (req.session.user.isAuth) {
    // current user is already logged in
    req.flash('info', { msg: 'You are already logged in, please log out first' });
    return res.redirect(req.session.returnTo || '/');
  }
  res.render('account/login', makeRenderObject({ title: 'Login' }, req));
};

/**
 * POST /login
 * Sign in using email and password.
 */
export const postLogin = async (req: Request, res: Response, next: NextFunction) => {
  // check for errors
  if (
    await isNotEmail(req) === false ||
    await isValidUsername(req) === false ||
    await checkPasswordLength(req) === false) {
    return res.redirect('/login');
  }
  // we're good, do something
  passport.authenticate('local', (err: Error, user: UserModel) => {
    if (err) { 
      return next(err); 
    }
    if (!user) {
      // authentication error
      return res.redirect('/login');
    }
    req.login(user, (err) => {
      if (err) { 
        return next(err); 
      }
      // update the sessions user.idProfile to match and update the Session tables idProfile
      const idProfile = user.idProfile;
      updateSession(idProfile, req.session.user.idSession);
      req.session.user.idProfile = idProfile;
      req.session.isAuth = true;
      req.session.user.isAuth = true;
      res.redirect(req.session.returnTo || '/');
    });
  })(req, res, next);
};

/**
 * GET /logout
 * Log out.
 */
export const logout = async (req: Request, res: Response) => {
  /*
  req.logout(); // this should destroy the cookie
  */
  req.logout();
  req.session.user.isAuth = false;
  req.session.isAuth = false;
  res.redirect(req.session.returnTo || '/');
};

/**
 * GET /signup
 * Signup page.
 */
export const getSignup = (req: Request, res: Response) => {
  if (req.session.user.isAuth) {
    req.flash('info', { msg: 'You are already logged in, please log out first' });
    return res.redirect('/');
  }
  res.render('account/signup', makeRenderObject({ title: 'Signup', showEmailUsageExplanation: true }, req));
};

/**
 * POST /signup
 * Create a new local account.
 */
export const postSignup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // check for errors
    if (
      await isNotEmail(req) === false ||
      await isValidUsername(req) === false ||
      await checkPasswordLength(req) === false ||
      await confirmMatchPassword(req) === false ||
      await usernameNotTaken(req) === false
    ) {
      return res.redirect('/signup');
    }

    const username = req.body.username;
    const password: string = await encryptPassword(req.body.password);
    // creates new user
    const newUser = {
      [usernameFieldName]: username,
      [passwordFieldName]: password,
    };

    const [error] = await updateUserNewSignup(username, password, req.session.user.idProfile);
    if (error) {
      return next(error);
    }

    // successful insertion
    req.logIn(newUser, (err) => {
      if (err) {
        return next(err);
      }
      // need to update session
      req.session.user.isAuth = true;
      req.session.isAuth = true;
      res.redirect(req.session.returnTo || '/');
    });
  } catch (err) {
    logger.error(err);
  }
};

/**
 * Function to create AnonymousUser
 */
export async function createAnonUser() {
  const username: null = null;
  const password: null = null;
  // creates new user
  const newUser = {
    [usernameFieldName]: username,
    [passwordFieldName]: password,
  };
  try {
    const [error, results] = await createUser(newUser);
    if (error) {
      throws;
    }
    //console.log(`anon user id = ${results.insertId}`);
    return results.insertId;
  } catch (err) {
    logger.error(err);
  }
}

export interface ExperimentRole {
  idExperiment: string;
  experiment: string;
  role: string;
}

/**
 * Function to get Active Experiments
 * 
 * check if experiments exist, if not update them
 * 
 */
async function getActiveExperiments(newSession: boolean, idSession: string) {
  try {
    // eslint-disable-next-line prefer-const
    let experiments: { [key: string]: any } = {};
    const [error, results] = await getUserExperiments(idSession);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    results.forEach(function(experimentRole: any, index: number, array: any){
      //console.log(experimentRole);
      const idExperiment: string = experimentRole.idExperiment;
      let role: string = experimentRole.role;
      const randrole: string = experimentRole.randrole;
      if(experimentRole.idSession !== idSession) {
        insertNewUserExperiment(idSession, idExperiment, randrole);
        role = randrole;
      } 
      //experiments.push( { idExperiment: idExperiment, experiment: experimentRole.experiment, role: role  } );
      experiments[experimentRole.experiment] = { idExperiment: idExperiment, role: role  };
    });
    if (error) {
      throws;
    }
    return experiments; // results.insertId; need to supply new IDs
  } catch (err) {
    logger.error(err);
  }
}

/**
 * Function to create new Session in our DB (not express-session)
 */
export async function createSessionDB(idProfile: number, idExpressSession: string) {
  const idSession = await insertSession(idProfile, idExpressSession);
  return idSession;
}

/**
 * GET /account
 * Profile page.
 */
export const getAccount = (req: Request, res: Response) => {
  let username = 'Anonymous User';
  if (req.session.user.isAuth) {
    const user = req.user as Partial<UserModel>;
    username = user.username;
  }
  res.render('account/profile', makeRenderObject({ title: 'Account Management', username: username, idProfile: req.session.user.idProfile, idSession: req.session.user.idSession, idExpress: req.sessionID }, req));
};

/**
 * POST /account/password
 * Update current password.
 */
export const postUpdatePassword = async (req: Request, res: Response, next: NextFunction) => {
  if (await checkPasswordLength(req) === false ||
    await confirmMatchPassword(req) === false
  ) {
    return res.redirect('/account');
  }

  const user = req.user as Partial<UserModel>;
  const username = user.username;
  const password: string = await encryptPassword(req.body.password);
  const updatedUser = {
    [passwordFieldName]: password,
  };

  const [error] = await updateUser(updatedUser, { [usernameFieldName]: username });
  if (error) {
    return next(error);
  }

  // successfully updated password
  req.flash('success', { msg: 'Password has been changed' });
  res.redirect('/account');
};

/**
 * GET /reset/:token
 * Reset Password page.
 */
export const getReset = async (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }

  const token = req.params.token;
  const [error, user] = await findUserByField(passwordResetToken, token);
  if (user == null) {
    req.flash('errors', { msg: 'Password reset token is invalid' });
    return res.redirect('/forget');
  }
  if (!user) {
    return next(error);
  }
  const expiration = user[passwordResetExpires];
  if (moment().isSameOrAfter(expiration)) {
    // reset token has expired
    req.flash('errors', { msg: 'Password reset token has expired' });
    return res.redirect('/forget');
  }

  // successful password reset
  res.render('account/reset', makeRenderObject({ title: 'Reset', username: user.username }, req));
};

/**
 * POST /reset/:token
 * Process the reset password request.
 */
export const postReset = async (req: Request, res: Response, next: NextFunction) => {
  if (await checkPasswordLength(req) === false ||
    await confirmMatchPassword(req) === false
  ) {
    return res.redirect('back');
  }

  async.waterfall([
    async function resetPassword(done: any) {
      const token = req.params.token;
      const [error, user] = await findUserByField(passwordResetToken, token);
      if (user == null) {
        req.flash('errors', { msg: 'Password reset token is invalid' });
        return res.redirect('back');
      }
      if (!user) {
        return next(error);
      }
      const expiration = user[passwordResetExpires];
      if (moment().isSameOrAfter(expiration)) {
        // reset token has expired
        req.flash('errors', { msg: 'Password reset token has expired' });
        return res.redirect('back');
      }
      // pass reset validation
      const password = req.body.password;
      const updatedUser: Partial<UserModel> = {
        [passwordFieldName]: password,
        [passwordResetToken]: null,
        [passwordResetExpires]: null,
      };

      const [updateError] = await updateUser(updatedUser, { [passwordResetToken]: token });
      if (updateError) {
        return done(updateError);
      }
      Object.assign(user, updatedUser);
      req.logIn(user, (err) => {
        done(err, user);
      });
    }
  ], (err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
};

/**
 * GET /forget
 * Forget Password page.
 */
export const getForget = (req: Request, res: Response) => {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.render('account/forget', makeRenderObject({ title: 'Forget Password' }, req));
};

/**
 * POST /forget
 * Create a random token
 */
export const postForget = async (req: Request, res: Response, next: NextFunction) => {
  if (
    await isNotEmail(req) === false ||
    await isValidUsername(req) === false ||
    await usernameExists(req) === false) {
    return res.redirect('/forget');
  }

  const username = req.body.username;
  async.waterfall([
    function createRandomToken(done: any) {
      crypto.randomBytes(256, (err, buf) => {
        const token = buf.toString('hex');
        done(err, token);
      });
    },
    async function setRandomToken(token: string, done: any) {
      const [error, user] = await findUserByField(usernameFieldName, username);
      if (user == null) {
        req.flash('errors', { msg: 'Account with that name does not exist.' });
        return res.redirect('/forget');
      }
      if (!user) {
        // QueryError or cannot find user by given email
        return done(error);
      }

      const expiration = moment();
      expiration.hour(expiration.hour() + 1); // 1 hour
      const updatedUser = {
        [passwordResetToken]: token,
        [passwordResetExpires]: expiration.toDate(),
      };

      const [updateError] = await updateUser(updatedUser, { [usernameFieldName]: username });
      if (updateError) {
        return done(updateError);
      }
      // successful
      Object.assign(user, updatedUser);
      done(error, token, user);
    }
  ], (err) => {
    if (err) { return next(err); }
    res.redirect('/forget');
  });
};

/**
 * GET /seenwelcome
 */
export const getSeenWelcome = (req: Request, res: Response) => {
  return res.status(200).json(req.session.user.seenWelcome);
};

/**
 * POST /seenwelcome
 */
export const postSeenWelcome = (req: Request, res: Response) => {
  req.session.user.seenWelcome = req.body.seenWelcome; // should be 0 or 1
  return res.status(200);
};

/**
 * GLOBAL MIDDLEWARE
 */
export async function checkSessionUser(req: Request, res: Response, next: NextFunction) {
  const uuid = req.cookies['draftyUnique'];
  const url = req.url;
  //console.log('Referer = ',req.header('Referer'));
  //console.log(req.headers);
  if (!req.session.user) {
    if (req.user) {
      logger.debug(req.sessionID + ' :: NO USER but there is a passport :: ' + req.user);
    }
    // sw: only place to create a new idProfile - this will get triggered before any login
    req.session.user = {
      idSession: -1,
      idProfile: await createAnonUser(),
      isAuth: false,
      isAdmin: false,
      activeExperiments: {},
      views: 0,
      trafficUUID: uuid,
      lastURL: url,
      seenWelcome: 0,
      lastInteraction: Date.now(),
      failedLoginAttempts: 0
    };
    next();
  } else {
    req.session.user.trafficUUID = uuid;
    req.session.user.lastURL = url;
    next();
  }
}

/**
 * GLOBAL MIDDLEWARE
 */
const heartbeat = 20 * 60000; // mins * 60000 milliseconds
export async function checkSessionId(req: Request, res: Response, next: NextFunction) {
  const interactionTime = Date.now();
  //logger.debug(await req.session.user.lastInteraction + ' == ' + interactionTime);
  //logger.debug(interactionTime - await req.session.user.lastInteraction);
  let newSession: boolean = false;
  if (((interactionTime - await req.session.user.lastInteraction) > heartbeat) || (await req.session.user.idSession === -1)) {
    req.session.user.idSession = await createSessionDB(req.session.user.idProfile, req.sessionID);
    newSession = true;
  }
  req.session.user.lastInteraction = interactionTime;
  req.session.user.views++;
  req.session.user.activeExperiments = getActiveExperiments(newSession, req.session.user.idSession);
  next();
}


/**
 * GLOBAL MIDDLEWARE
 */
export async function checkReturnPath(req: Request, res: Response, next: NextFunction) {
  if (!req.path.includes('favicon')) {
    req.session.returnTo = req.path;
  }
  next();
}