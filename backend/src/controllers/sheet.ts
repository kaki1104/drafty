import { Request, Response } from 'express';
import { sheetsData, getRequestedSheetName, getRequestedSheetPath, getRequestedEditHistorySheetPath } from '../models/sheet';
import { makeRenderObject } from '../config/handlebars-helpers';
// import { genSheets } from "../database/gen_spreadsheets";

/**
 * GET /sheet/:sheet
 * Sheet page.
 */
export async function getSheet(req: Request, res: Response) {
  const sheetURL = req.params.sheet;

  // check if sheet exists
  if (!sheetsData.has(sheetURL)) {
    if(sheetURL !== 'service-worker.js') { // sw bug: service-worker.js is getting this endpoint
      //sw creates annoying behavior
      //Oh sorry we cannot find requested sheet :("});
    }
    return res.redirect('/');
  } 

  // run through permissions/settings
  const sheetData = sheetsData.get(sheetURL);

  if(!req.session.user.isAuth && sheetData.login_required) {
    res.render('account/signup', makeRenderObject({ title: 'Signup' }, req));
  } else if (req.session.user.isAuth && !req.session.user.isAdmin && sheetData.admin_only) {
    req.flash('errors', { msg: 'Oh sorry this sheet is protected or under development :('});
  } else {
    const sheetName = await getRequestedSheetName(sheetURL);
    const sheetPath = await getRequestedSheetPath(sheetURL);
    res.render('pages/sheet', makeRenderObject({ title: `${sheetName}`, sheetName: sheetName, sheetPath: sheetPath, sheetURL: sheetURL }, req));
  }
}

/**
 * GET /:sheet/edit_history
 * Sheet page.
 */
export async function getSheetEditHistory(req: Request, res: Response) {
  const sheetURL = req.params.sheet;
  
  // check if sheet exists
  if (!sheetsData.has(sheetURL)) {
    return res.redirect('/');
  } 

  // run through permissions/settings
  const sheetData = sheetsData.get(sheetURL);

  if(!req.session.user.isAuth && sheetData.login_required) {
    res.render('account/signup', makeRenderObject({ title: 'Signup' }, req));
  } else if (req.session.user.isAuth && !req.session.user.isAdmin && sheetData.admin_only) {
    req.flash('errors', { msg: 'Oh sorry this sheet is protected or under development :('});
  } else {
    const sheetName = await getRequestedSheetName(sheetURL);
    const editHistoryPath = await getRequestedEditHistorySheetPath(sheetURL);
    res.render('pages/edit_history', makeRenderObject({ title: `${sheetName}`, sheetName: sheetName, sheetURL: sheetURL, editHistoryPath: editHistoryPath }, req));
  }
}
