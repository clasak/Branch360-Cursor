//
//  User.swift
//  Branch360
//
//  TODO: Implement User model
//  - Match schema from config.gs (UserID, Name, Email, Role, etc.)
//  - Role enumeration
//  - Territory management
//  - Preferences
//

import Foundation

struct User: Codable {
    // TODO: Implement based on config.gs schema
    // UserID, Name, Email, Role, BranchID, TerritoryZips, etc.
}

enum UserRole: String, Codable {
    case ae = "Account Executive"
    case tech = "Technician"
    case opsMgr = "Operations Manager"
    case branchMgr = "Branch Manager"
    case regionalDir = "Regional Director"
    case marketDir = "Market Director"
    case executive = "Executive"
    case admin = "Administrator"
}

